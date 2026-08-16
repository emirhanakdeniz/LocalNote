use crate::database::{self, DatabaseError, DatabaseState};
use rusqlite::{params, Connection, Transaction};
use serde::Serialize;
use serde_json::Value;

pub(crate) const SEARCH_RESULT_LIMIT: usize = 15;
const MAX_QUERY_CHARACTERS: usize = 200;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchResult {
    pub(crate) page_id: String,
    pub(crate) title: String,
    pub(crate) snippet: String,
}

pub(crate) fn search(
    state: &DatabaseState,
    query: &str,
) -> Result<Vec<SearchResult>, DatabaseError> {
    let Some(fts_query) = plain_text_query(query)? else {
        return Ok(Vec::new());
    };
    let connection = database::connection(state)?;
    let limit = i64::try_from(SEARCH_RESULT_LIMIT)
        .map_err(|error| DatabaseError::context("Search result limit is invalid", error))?;
    let mut statement = connection.prepare(
        "SELECT page_id, title,
                snippet(page_search, 2, '', '', ' … ', 18) AS body_snippet
         FROM page_search
         WHERE page_search MATCH ?1
         ORDER BY bm25(page_search, 0.0, 8.0, 1.0),
                  title COLLATE NOCASE,
                  page_id
         LIMIT ?2",
    )?;
    let results = statement
        .query_map(params![fts_query, limit], |row| {
            Ok(SearchResult {
                page_id: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(results)
}

pub(crate) fn backfill(transaction: &Transaction<'_>) -> Result<(), DatabaseError> {
    let mut statement = transaction.prepare(
        "SELECT pages.id, pages.title, documents.content_json
         FROM pages
         LEFT JOIN documents ON documents.page_id = pages.id
         ORDER BY pages.created_at, pages.id",
    )?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(statement);

    for (page_id, title, content_json) in rows {
        let body = match content_json {
            Some(content_json) => match extract_document_text(&content_json) {
                Ok(body) => body,
                Err(error) => {
                    eprintln!(
                        "LocalNote search skipped malformed body for page '{page_id}': {error}"
                    );
                    String::new()
                }
            },
            None => String::new(),
        };
        insert_page(transaction, &page_id, &title, &body)?;
    }
    Ok(())
}

pub(crate) fn insert_page(
    connection: &Connection,
    page_id: &str,
    title: &str,
    body: &str,
) -> Result<(), DatabaseError> {
    connection.execute(
        "INSERT INTO page_search (page_id, title, body) VALUES (?1, ?2, ?3)",
        params![page_id, title, body],
    )?;
    Ok(())
}

pub(crate) fn update_title(
    connection: &Connection,
    page_id: &str,
    title: &str,
) -> Result<(), DatabaseError> {
    let changed = connection.execute(
        "UPDATE page_search SET title = ?1 WHERE page_id = ?2",
        params![title, page_id],
    )?;
    ensure_indexed(changed, page_id)
}

pub(crate) fn update_body(
    connection: &Connection,
    page_id: &str,
    body: &str,
) -> Result<(), DatabaseError> {
    let changed = connection.execute(
        "UPDATE page_search SET body = ?1 WHERE page_id = ?2",
        params![body, page_id],
    )?;
    ensure_indexed(changed, page_id)
}

pub(crate) fn delete_page(connection: &Connection, page_id: &str) -> Result<(), DatabaseError> {
    connection.execute("DELETE FROM page_search WHERE page_id = ?1", [page_id])?;
    Ok(())
}

pub(crate) fn extract_document_text(content_json: &str) -> Result<String, DatabaseError> {
    let document: Value = serde_json::from_str(content_json).map_err(|error| {
        DatabaseError::context("Could not extract searchable document text", error)
    })?;
    let blocks = document.as_array().ok_or_else(|| {
        DatabaseError::message("Could not extract search text from a non-array document")
    })?;
    let mut segments = Vec::new();
    for block in blocks {
        extract_block(block, &mut segments);
    }
    Ok(segments.join("\n"))
}

fn extract_block(block: &Value, segments: &mut Vec<String>) {
    if let Some(content) = block.get("content") {
        let mut text = String::new();
        extract_inline_content(content, &mut text);
        let text = text.trim();
        if !text.is_empty() {
            segments.push(text.to_owned());
        }
    }
    if let Some(children) = block.get("children").and_then(Value::as_array) {
        for child in children {
            extract_block(child, segments);
        }
    }
}

fn extract_inline_content(value: &Value, output: &mut String) {
    match value {
        Value::String(text) => output.push_str(text),
        Value::Array(items) => {
            for item in items {
                extract_inline_content(item, output);
            }
        }
        Value::Object(object) => {
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                output.push_str(text);
            } else if let Some(content) = object.get("content") {
                extract_inline_content(content, output);
            }
        }
        _ => {}
    }
}

fn plain_text_query(query: &str) -> Result<Option<String>, DatabaseError> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(None);
    }
    if query.chars().count() > MAX_QUERY_CHARACTERS {
        return Err(DatabaseError::message(format!(
            "Search queries cannot exceed {MAX_QUERY_CHARACTERS} characters"
        )));
    }

    let mut terms = Vec::new();
    let mut current = String::new();
    for character in query.chars() {
        if character.is_alphanumeric() || character == '_' {
            current.push(character);
        } else if !current.is_empty() {
            terms.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        terms.push(current);
    }
    if terms.is_empty() {
        return Ok(None);
    }

    Ok(Some(
        terms
            .into_iter()
            .map(|term| format!("\"{term}\"*"))
            .collect::<Vec<_>>()
            .join(" AND "),
    ))
}

fn ensure_indexed(changed: usize, page_id: &str) -> Result<(), DatabaseError> {
    if changed == 0 {
        return Err(DatabaseError::message(format!(
            "Search index entry for page '{page_id}' does not exist"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{documents, pages};
    use tempfile::TempDir;

    fn search_database() -> (TempDir, DatabaseState) {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();
        (directory, state)
    }

    fn create_named_page(state: &DatabaseState, title: &str) -> pages::Page {
        let page = pages::create(state, None).unwrap();
        pages::rename(state, &page.id, title).unwrap()
    }

    #[test]
    fn extracts_visible_text_from_representative_blocknote_blocks() {
        let document = r#"[
          {"type":"heading","props":{"level":1},"content":[{"type":"text","text":"Heading","styles":{"bold":true}}],"children":[]},
          {"type":"paragraph","content":[{"type":"link","href":"https://example.com","content":[{"type":"text","text":"linked words","styles":{}}]}]},
          {"type":"bulletListItem","content":"Bullet item","children":[{"type":"numberedListItem","content":"Nested number"}]},
          {"type":"checkListItem","props":{"checked":true},"content":[{"type":"text","text":"Todo text","styles":{}}]},
          {"type":"quote","content":"Quoted text"},
          {"type":"codeBlock","props":{"language":"rust"},"content":[{"type":"text","text":"let searchable = true;","styles":{}}]},
          {"type":"callout","props":{"icon":"info"},"content":"Callout text"},
          {"type":"divider","content":[]}
        ]"#;

        assert_eq!(
            extract_document_text(document).unwrap(),
            "Heading\nlinked words\nBullet item\nNested number\nTodo text\nQuoted text\nlet searchable = true;\nCallout text"
        );
        assert!(!document.contains("mutated"));
    }

    #[test]
    fn searches_titles_bodies_and_prefixes_with_title_weighting() {
        let (_directory, state) = search_database();
        let title_match = create_named_page(&state, "Alpha planning");
        let body_match = create_named_page(&state, "Ordinary note");
        documents::save(
            &state,
            &body_match.id,
            r#"[{"type":"paragraph","content":"alpha appears in the body"}]"#,
        )
        .unwrap();

        let results = search(&state, "alp").unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].page_id, title_match.id);
        assert_eq!(results[1].page_id, body_match.id);
        assert!(results[1].snippet.contains("alpha appears"));
    }

    #[test]
    fn ranking_ties_are_deterministic() {
        let (_directory, state) = search_database();
        let zebra = create_named_page(&state, "Zebra");
        let alpha = create_named_page(&state, "Alpha");
        for page in [&zebra, &alpha] {
            documents::save(
                &state,
                &page.id,
                r#"[{"type":"paragraph","content":"shared deterministic phrase"}]"#,
            )
            .unwrap();
        }

        let first = search(&state, "deterministic").unwrap();
        let second = search(&state, "deterministic").unwrap();
        assert_eq!(first, second);
        assert_eq!(
            first
                .iter()
                .map(|result| result.title.as_str())
                .collect::<Vec<_>>(),
            ["Alpha", "Zebra"]
        );
    }

    #[test]
    fn rename_save_delete_and_parent_promotion_keep_index_consistent() {
        let (_directory, state) = search_database();
        let parent = create_named_page(&state, "Disposable parent");
        let child = pages::create(&state, Some(parent.id.clone())).unwrap();
        pages::rename(&state, &child.id, "Original child").unwrap();

        assert_eq!(search(&state, "Original").unwrap()[0].page_id, child.id);
        pages::rename(&state, &child.id, "Renamed child").unwrap();
        assert!(search(&state, "Original").unwrap().is_empty());
        assert_eq!(search(&state, "Renamed").unwrap()[0].page_id, child.id);

        documents::save(
            &state,
            &child.id,
            r#"[{"type":"paragraph","content":"fresh autosaved token"}]"#,
        )
        .unwrap();
        assert_eq!(search(&state, "autosaved").unwrap()[0].page_id, child.id);

        pages::delete(&state, &parent.id).unwrap();
        assert_eq!(search(&state, "autosaved").unwrap()[0].page_id, child.id);
        pages::delete(&state, &child.id).unwrap();
        assert!(search(&state, "autosaved").unwrap().is_empty());
        assert!(search(&state, "Renamed").unwrap().is_empty());
    }

    #[test]
    fn treats_queries_as_bounded_plain_text_and_handles_empty_input() {
        let (_directory, state) = search_database();
        create_named_page(&state, "OR NEAR DROP TABLE notes");

        assert!(search(&state, "   ").unwrap().is_empty());
        assert!(search(&state, "***").unwrap().is_empty());
        assert!(!search(&state, "\" OR NEAR() -- DROP TABLE")
            .unwrap()
            .is_empty());
        assert!(search(&state, &"a".repeat(MAX_QUERY_CHARACTERS + 1)).is_err());
        assert_eq!(pages::list(&state).unwrap().len(), 1);
    }

    #[test]
    fn enforces_the_result_limit() {
        let (_directory, state) = search_database();
        for index in 0..(SEARCH_RESULT_LIMIT + 4) {
            create_named_page(&state, &format!("Common result {index:02}"));
        }

        let results = search(&state, "Common").unwrap();
        assert_eq!(results.len(), SEARCH_RESULT_LIMIT);
        assert_eq!(results[0].title, "Common result 00");
    }

    #[test]
    fn search_unicode_and_punctuation_stress() {
        let (_directory, state) = search_database();
        let page = create_named_page(&state, "🚀 Uzay Görevi & Türkçe Notlar (2026)");
        documents::save(
            &state,
            &page.id,
            r#"[{"type":"paragraph","content":"Gelişmiş FTS5 arama motoru ile ğüşıöç testleri yapılıyor."}]"#,
        )
        .unwrap();

        // Search by Turkish unicode title fragment
        let title_results = search(&state, "Görevi").unwrap();
        assert_eq!(title_results.len(), 1);
        assert_eq!(title_results[0].page_id, page.id);

        // Search by Turkish unicode body fragment
        let body_results = search(&state, "motoru").unwrap();
        assert_eq!(body_results.len(), 1);
        assert_eq!(body_results[0].page_id, page.id);
        assert!(body_results[0].snippet.contains("motoru"));

        // Malformed punctuation and symbols should not error
        assert!(search(&state, "🚀").unwrap().is_empty() || !search(&state, "🚀").unwrap().is_empty());
        assert!(search(&state, "\"-- AND OR ()").unwrap().is_empty());
    }
}
