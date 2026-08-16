use crate::database::{self, DatabaseError, DatabaseState};
use crate::search;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use serde_json::Value;

const MAX_DOCUMENT_BYTES: usize = 16 * 1024 * 1024;
const UTC_NOW_SQL: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Document {
    pub(crate) page_id: String,
    pub(crate) content_json: Option<String>,
    pub(crate) updated_at: Option<String>,
}

pub(crate) fn load(state: &DatabaseState, page_id: &str) -> Result<Document, DatabaseError> {
    validate_page_id(page_id)?;
    let connection = database::connection(state)?;
    ensure_page_exists(&connection, page_id)?;

    let stored = connection
        .query_row(
            "SELECT content_json, updated_at FROM documents WHERE page_id = ?1",
            [page_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?;

    Ok(match stored {
        Some((content_json, updated_at)) => Document {
            page_id: page_id.to_owned(),
            content_json: Some(content_json),
            updated_at: Some(updated_at),
        },
        None => Document {
            page_id: page_id.to_owned(),
            content_json: None,
            updated_at: None,
        },
    })
}

pub(crate) fn save(
    state: &DatabaseState,
    page_id: &str,
    content_json: &str,
) -> Result<Document, DatabaseError> {
    validate_page_id(page_id)?;
    validate_content(content_json)?;
    let searchable_text = search::extract_document_text(content_json)?;
    let mut connection = database::connection(state)?;
    ensure_page_exists(&connection, page_id)?;
    let transaction = connection.transaction()?;

    transaction.execute(
        &format!(
            "INSERT INTO documents (page_id, content_json, updated_at)
             VALUES (?1, ?2, {UTC_NOW_SQL})
             ON CONFLICT(page_id) DO UPDATE SET
                 content_json = excluded.content_json,
                 updated_at = excluded.updated_at"
        ),
        params![page_id, content_json],
    )?;
    search::update_body(&transaction, page_id, &searchable_text)?;
    transaction.commit()?;

    load(state, page_id)
}

fn validate_page_id(page_id: &str) -> Result<(), DatabaseError> {
    if page_id.trim().is_empty() {
        return Err(DatabaseError::message("Page ID cannot be empty"));
    }
    Ok(())
}

fn validate_content(content_json: &str) -> Result<(), DatabaseError> {
    if content_json.len() > MAX_DOCUMENT_BYTES {
        return Err(DatabaseError::message(format!(
            "Document JSON cannot exceed {MAX_DOCUMENT_BYTES} bytes"
        )));
    }

    let value: Value = serde_json::from_str(content_json)
        .map_err(|error| DatabaseError::context("Document payload is not valid JSON", error))?;
    if !value.is_array() {
        return Err(DatabaseError::message(
            "Document JSON must contain a top-level block array",
        ));
    }
    Ok(())
}

fn ensure_page_exists(
    connection: &rusqlite::Connection,
    page_id: &str,
) -> Result<(), DatabaseError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM pages WHERE id = ?1 AND deleted_at IS NULL)",
        [page_id],
        |row| row.get(0),
    )?;
    if !exists {
        return Err(DatabaseError::message(format!(
            "Page '{page_id}' does not exist"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pages;
    use tempfile::TempDir;

    fn document_database() -> (TempDir, DatabaseState) {
        let directory = TempDir::new().expect("temporary directory should be created");
        let state = database::initialize(directory.path()).expect("database should initialize");
        (directory, state)
    }

    #[test]
    fn missing_document_is_a_valid_empty_state() {
        let (_directory, state) = document_database();
        let page = pages::create(&state, None).unwrap();

        let document = load(&state, &page.id).unwrap();
        assert_eq!(document.content_json, None);
        assert_eq!(document.updated_at, None);
    }

    #[test]
    fn first_save_creates_and_subsequent_save_updates_the_document() {
        let (_directory, state) = document_database();
        let page = pages::create(&state, None).unwrap();
        let first = r#"[{"type":"paragraph","content":"First"}]"#;
        let second = r#"[{"type":"heading","content":"Second"}]"#;

        let created = save(&state, &page.id, first).unwrap();
        assert_eq!(created.content_json.as_deref(), Some(first));
        assert!(created.updated_at.as_deref().unwrap().ends_with('Z'));

        std::thread::sleep(std::time::Duration::from_millis(2));
        let updated = save(&state, &page.id, second).unwrap();
        assert_eq!(updated.content_json.as_deref(), Some(second));
        assert!(updated.updated_at > created.updated_at);
        let connection = database::connection(&state).unwrap();
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE page_id = ?1",
                [&page.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn document_json_round_trips_without_transformation() {
        let (directory, state) = document_database();
        let page = pages::create(&state, None).unwrap();
        let content = r#"[{"id":"block-1","type":"paragraph","props":{"textColor":"default"},"content":[{"type":"text","text":"A & B","styles":{"bold":true}}],"children":[]}]"#;
        save(&state, &page.id, content).unwrap();

        let reopened = database::initialize(directory.path()).unwrap();
        assert_eq!(
            load(&reopened, &page.id).unwrap().content_json.as_deref(),
            Some(content)
        );
    }

    #[test]
    fn rejects_invalid_json_non_array_payloads_and_unknown_pages() {
        let (_directory, state) = document_database();
        let page = pages::create(&state, None).unwrap();

        assert!(save(&state, &page.id, "not json").is_err());
        assert!(save(&state, &page.id, r#"{"type":"paragraph"}"#).is_err());
        assert!(save(&state, "missing-page", "[]").is_err());
        assert!(load(&state, "missing-page").is_err());
        assert_eq!(load(&state, &page.id).unwrap().content_json, None);
    }

    #[test]
    fn deleting_a_page_cascades_only_its_own_document() {
        let (_directory, state) = document_database();
        let first = pages::create(&state, None).unwrap();
        let second = pages::create(&state, None).unwrap();
        save(
            &state,
            &first.id,
            r#"[{"type":"paragraph","content":"First"}]"#,
        )
        .unwrap();
        save(
            &state,
            &second.id,
            r#"[{"type":"paragraph","content":"Second"}]"#,
        )
        .unwrap();

        pages::delete(&state, &first.id).unwrap();

        assert!(load(&state, &first.id).is_err());
        assert!(load(&state, &second.id)
            .unwrap()
            .content_json
            .unwrap()
            .contains("Second"));
    }

    #[test]
    fn promoted_child_keeps_its_document_when_parent_is_deleted() {
        let (_directory, state) = document_database();
        let parent = pages::create(&state, None).unwrap();
        let child = pages::create(&state, Some(parent.id.clone())).unwrap();
        save(
            &state,
            &parent.id,
            r#"[{"type":"paragraph","content":"Parent"}]"#,
        )
        .unwrap();
        save(
            &state,
            &child.id,
            r#"[{"type":"paragraph","content":"Child"}]"#,
        )
        .unwrap();

        let remaining = pages::delete(&state, &parent.id).unwrap();
        let promoted = remaining.iter().find(|page| page.id == child.id).unwrap();

        assert_eq!(promoted.parent_id, None);
        assert!(load(&state, &child.id)
            .unwrap()
            .content_json
            .unwrap()
            .contains("Child"));
        assert!(load(&state, &parent.id).is_err());

        // Permanently deleting the parent removes its document completely
        pages::delete_permanently(&state, &parent.id).unwrap();
        let connection = database::connection(&state).unwrap();
        let parent_documents: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE page_id = ?1",
                [&parent.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(parent_documents, 0);
    }

    #[test]
    fn malformed_stored_json_is_returned_unchanged_and_not_replaced() {
        let (_directory, state) = document_database();
        let page = pages::create(&state, None).unwrap();
        let connection = database::connection(&state).unwrap();
        connection
            .execute(
                "INSERT INTO documents (page_id, content_json, updated_at)
                 VALUES (?1, ?2, '2026-01-01T00:00:00.000Z')",
                params![page.id, "{malformed"],
            )
            .unwrap();

        let loaded = load(&state, &page.id).unwrap();
        assert_eq!(loaded.content_json.as_deref(), Some("{malformed"));
        assert!(save(&state, &page.id, "also malformed").is_err());
        assert_eq!(
            load(&state, &page.id).unwrap().content_json.as_deref(),
            Some("{malformed")
        );
    }

    #[test]
    fn stress_rapid_consecutive_saves_with_unicode_and_increasing_sizes() {
        let (_directory, state) = document_database();
        let page = pages::create(&state, None).unwrap();

        // 50 consecutive saves simulating fast typing bursts with unicode and growing blocks
        for i in 1..=50 {
            let payload = format!(
                r#"[
                    {{"id":"b0","type":"paragraph","content":"Burst {i} 🚀 Türkçe karakterler: ğüşıöç 🌟"}},
                    {{"id":"b1","type":"codeBlock","props":{{"language":"typescript"}},"content":"const count = {i};"}}
                ]"#
            );
            let saved = save(&state, &page.id, &payload).unwrap();
            assert_eq!(saved.page_id, page.id);
            assert!(saved.content_json.as_ref().unwrap().contains(&format!("Burst {i}")));
        }

        let final_doc = load(&state, &page.id).unwrap();
        let json = final_doc.content_json.unwrap();
        assert!(json.contains("Burst 50"));
        assert!(json.contains("Türkçe karakterler: ğüşıöç"));
    }
}
