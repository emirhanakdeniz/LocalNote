use crate::{
    database::{self, DatabaseError, DatabaseState},
    documents,
    pages::{self, Page},
    search,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

const MAX_TITLE_LENGTH: usize = 200;
const UTC_NOW_SQL: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownSource {
    pub file_name: String,
    pub markdown: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportNoteItem {
    pub title: String,
    pub content_json: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportResult {
    pub imported_count: usize,
    pub pages: Vec<Page>,
    pub first_page_id: Option<String>,
}

pub(crate) fn select_markdown_files(app: &AppHandle) -> Result<Vec<MarkdownSource>, DatabaseError> {
    let Some(selected) = app
        .dialog()
        .file()
        .set_title("Import Markdown notes")
        .add_filter("Markdown", &["md"])
        .blocking_pick_files()
    else {
        return Ok(Vec::new());
    };

    selected
        .into_iter()
        .map(|selected_path| {
            let path = selected_path.into_path().map_err(|error| {
                DatabaseError::context("The selected Markdown source is not a local file", error)
            })?;
            if !path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
            {
                return Err(DatabaseError::message(format!(
                    "'{}' is not a Markdown (.md) file",
                    path.display()
                )));
            }
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or_else(|| DatabaseError::message("A selected file name is not valid UTF-8"))?
                .to_owned();
            let markdown = fs::read_to_string(&path).map_err(|error| {
                DatabaseError::context(
                    format!("Could not read Markdown file '{}' as UTF-8", path.display()),
                    error,
                )
            })?;
            Ok(MarkdownSource {
                file_name,
                markdown,
            })
        })
        .collect()
}

pub(crate) fn import_notes(
    state: &DatabaseState,
    notes: Vec<ImportNoteItem>,
) -> Result<ImportResult, DatabaseError> {
    if notes.is_empty() {
        return Err(DatabaseError::message(
            "At least one Markdown note is required",
        ));
    }

    let prepared = notes
        .into_iter()
        .map(|note| {
            let title = note.title.trim().to_owned();
            if title.is_empty() {
                return Err(DatabaseError::message(
                    "Imported note titles cannot be empty",
                ));
            }
            if title.chars().count() > MAX_TITLE_LENGTH {
                return Err(DatabaseError::message(format!(
                    "Imported note titles cannot exceed {MAX_TITLE_LENGTH} characters"
                )));
            }
            documents::validate_content(&note.content_json)?;
            let searchable_text = search::extract_document_text(&note.content_json)?;
            Ok((title, note.content_json, searchable_text))
        })
        .collect::<Result<Vec<_>, DatabaseError>>()?;

    let imported_count = prepared.len();
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let mut next_position: i64 = transaction.query_row(
        "SELECT COUNT(*) FROM pages WHERE parent_id IS NULL AND deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;
    let mut first_page_id = None;

    for (title, content_json, searchable_text) in prepared {
        let id = Uuid::new_v4().to_string();
        transaction.execute(
            &format!(
                "INSERT INTO pages
                 (id, title, parent_id, position, created_at, updated_at)
                 VALUES (?1, ?2, NULL, ?3, {UTC_NOW_SQL}, {UTC_NOW_SQL})"
            ),
            params![id, title, next_position],
        )?;
        transaction.execute(
            &format!(
                "INSERT INTO documents (page_id, content_json, updated_at)
                 VALUES (?1, ?2, {UTC_NOW_SQL})"
            ),
            params![id, content_json],
        )?;
        search::insert_page(&transaction, &id, &title, &searchable_text)?;
        first_page_id.get_or_insert_with(|| id.clone());
        next_position += 1;
    }

    let pages = pages::list_with_connection(&transaction)?;
    transaction.commit()?;

    Ok(ImportResult {
        imported_count,
        pages,
        first_page_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{documents, search};
    use tempfile::TempDir;

    fn import_database() -> (TempDir, DatabaseState) {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(&directory.path().join("localnote.db")).unwrap();
        (directory, state)
    }

    fn item(title: &str, body: &str) -> ImportNoteItem {
        ImportNoteItem {
            title: title.to_owned(),
            content_json: format!(r#"[{{"type":"paragraph","content":"{body}"}}]"#),
        }
    }

    #[test]
    fn imports_multiple_utf8_notes_as_distinct_roots_with_documents_and_search() {
        let (_directory, state) = import_database();
        pages::create(&state, None).unwrap();

        let result = import_notes(
            &state,
            vec![
                item("Aynı Başlık", "Türkçe içerik"),
                item("Aynı Başlık", "ikinci içerik"),
            ],
        )
        .unwrap();

        assert_eq!(result.imported_count, 2);
        let imported = result
            .pages
            .iter()
            .filter(|page| page.title == "Aynı Başlık")
            .collect::<Vec<_>>();
        assert_eq!(imported.len(), 2);
        assert!(imported.iter().all(|page| page.parent_id.is_none()));
        assert!(documents::load(&state, &imported[0].id)
            .unwrap()
            .content_json
            .unwrap()
            .contains("içerik"));
        assert_eq!(search::search(&state, "Türkçe").unwrap().len(), 1);
    }

    #[test]
    fn accepts_an_empty_block_array() {
        let (_directory, state) = import_database();
        let result = import_notes(
            &state,
            vec![ImportNoteItem {
                title: "Empty".to_owned(),
                content_json: "[]".to_owned(),
            }],
        )
        .unwrap();
        assert_eq!(result.imported_count, 1);
        assert_eq!(
            documents::load(&state, result.first_page_id.as_deref().unwrap())
                .unwrap()
                .content_json
                .as_deref(),
            Some("[]")
        );
    }

    #[test]
    fn invalid_content_rolls_back_the_entire_batch() {
        let (_directory, state) = import_database();
        let result = import_notes(
            &state,
            vec![
                item("Valid", "would be rolled back"),
                ImportNoteItem {
                    title: "Invalid".to_owned(),
                    content_json: "not-json".to_owned(),
                },
            ],
        );
        assert!(result.is_err());
        assert!(pages::list(&state).unwrap().is_empty());
        assert!(search::search(&state, "rolled").unwrap().is_empty());
    }

    #[test]
    fn database_failure_after_the_first_insert_rolls_back_pages_documents_and_search() {
        let (_directory, state) = import_database();
        let connection = database::connection(&state).unwrap();
        connection
            .execute_batch(
                "CREATE TRIGGER reject_forced_import
                 BEFORE INSERT ON documents
                 WHEN NEW.content_json LIKE '%force database failure%'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced import failure');
                 END;",
            )
            .unwrap();
        drop(connection);

        let result = import_notes(
            &state,
            vec![
                item("First", "would otherwise persist"),
                item("Second", "force database failure"),
            ],
        );

        assert!(result.is_err());
        let connection = database::connection(&state).unwrap();
        let document_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
            .unwrap();
        let search_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM page_search", [], |row| row.get(0))
            .unwrap();
        assert!(pages::list(&state).unwrap().is_empty());
        assert_eq!(document_count, 0);
        assert_eq!(search_count, 0);
    }
}
