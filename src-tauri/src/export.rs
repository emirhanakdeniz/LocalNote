use crate::database::{self, DatabaseError, DatabaseState};
use rusqlite::OptionalExtension;
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

const FALLBACK_FILENAME: &str = "Untitled";
const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportResult {
    exported: bool,
}

pub(crate) fn export_markdown(
    app: &AppHandle,
    state: &DatabaseState,
    page_id: &str,
    expected_content_json: Option<&str>,
    markdown: &str,
) -> Result<ExportResult, DatabaseError> {
    let (title, stored_content_json) = persisted_export_source(state, page_id)?;
    if stored_content_json.as_deref() != expected_content_json {
        return Err(DatabaseError::message(
            "The note changed before export. Try exporting again so the latest saved content is used.",
        ));
    }

    let selected = app
        .dialog()
        .file()
        .set_title("Export page as Markdown")
        .set_file_name(safe_markdown_filename(&title))
        .add_filter("Markdown", &["md"])
        .blocking_save_file();

    let Some(selected) = selected else {
        return Ok(ExportResult { exported: false });
    };

    let path = ensure_markdown_extension(selected.into_path().map_err(|error| {
        DatabaseError::context(
            "The selected export destination is not a local file path",
            error,
        )
    })?);
    write_markdown(&path, markdown)?;
    Ok(ExportResult { exported: true })
}

fn persisted_export_source(
    state: &DatabaseState,
    page_id: &str,
) -> Result<(String, Option<String>), DatabaseError> {
    if page_id.trim().is_empty() {
        return Err(DatabaseError::message("Page ID cannot be empty"));
    }

    let connection = database::connection(state)?;
    connection
        .query_row(
            "SELECT pages.title, documents.content_json
             FROM pages
             LEFT JOIN documents ON documents.page_id = pages.id
             WHERE pages.id = ?1",
            [page_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| DatabaseError::message(format!("Page '{page_id}' does not exist")))
}

pub(crate) fn safe_markdown_filename(title: &str) -> String {
    let mut stem: String = title
        .trim()
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect();

    stem = stem.trim_end_matches([' ', '.']).to_owned();
    if stem.is_empty() {
        stem = FALLBACK_FILENAME.to_owned();
    }

    let reserved_candidate = stem.split('.').next().unwrap_or_default();
    if WINDOWS_RESERVED_NAMES
        .iter()
        .any(|reserved| reserved_candidate.eq_ignore_ascii_case(reserved))
    {
        stem.insert(0, '_');
    }

    format!("{stem}.md")
}

fn ensure_markdown_extension(mut path: PathBuf) -> PathBuf {
    if !path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        path.set_extension("md");
    }
    path
}

fn write_markdown(path: &Path, markdown: &str) -> Result<(), DatabaseError> {
    fs::write(path, markdown)
        .map_err(|error| DatabaseError::context("Could not write the Markdown export", error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{documents, pages};
    use tempfile::TempDir;

    fn export_database() -> (TempDir, DatabaseState) {
        let directory = TempDir::new().expect("temporary directory should be created");
        let state = database::initialize(directory.path()).expect("database should initialize");
        (directory, state)
    }

    #[test]
    fn sanitizes_normal_invalid_empty_reserved_and_trailing_titles() {
        assert_eq!(safe_markdown_filename("Project notes"), "Project notes.md");
        assert_eq!(
            safe_markdown_filename("Plan: Q3/Windows?"),
            "Plan_ Q3_Windows_.md"
        );
        assert_eq!(safe_markdown_filename("  "), "Untitled.md");
        assert_eq!(safe_markdown_filename("CON"), "_CON.md");
        assert_eq!(safe_markdown_filename("nul.txt"), "_nul.txt.md");
        assert_eq!(safe_markdown_filename("Draft.  "), "Draft.md");
    }

    #[test]
    fn writes_utf8_and_replaces_only_the_explicit_path() {
        let directory = TempDir::new().unwrap();
        let path = directory.path().join("selected.md");
        fs::write(&path, "old content").unwrap();

        write_markdown(&path, "ç ğ ı İ ö ş ü").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "ç ğ ı İ ö ş ü");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn enforces_the_markdown_extension() {
        assert_eq!(
            ensure_markdown_extension(PathBuf::from("note.txt")),
            PathBuf::from("note.md")
        );
        assert_eq!(
            ensure_markdown_extension(PathBuf::from("note.MD")),
            PathBuf::from("note.MD")
        );
    }

    #[test]
    fn reads_the_authoritative_title_and_document_without_modifying_them() {
        let (_directory, state) = export_database();
        let page = pages::create(&state, None).unwrap();
        pages::rename(&state, &page.id, "Başlık").unwrap();
        let content = r#"[{"type":"paragraph","content":"İçerik"}]"#;
        documents::save(&state, &page.id, content).unwrap();

        let source = persisted_export_source(&state, &page.id).unwrap();

        assert_eq!(source, ("Başlık".to_owned(), Some(content.to_owned())));
        assert_eq!(
            documents::load(&state, &page.id)
                .unwrap()
                .content_json
                .as_deref(),
            Some(content)
        );
    }

    #[test]
    fn missing_page_is_an_error_before_any_dialog_or_write() {
        let (_directory, state) = export_database();
        assert!(persisted_export_source(&state, "missing").is_err());
    }
}
