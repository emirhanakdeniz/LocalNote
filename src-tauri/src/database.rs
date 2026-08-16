use crate::search;
use rusqlite::Connection;
use serde::Serialize;
use std::{
    error::Error,
    fmt::{Display, Formatter},
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

const DATABASE_FILENAME: &str = "localnote.db";
const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

struct Migration {
    version: u32,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        sql: r#"
        CREATE TABLE pages (
            id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
            title TEXT NOT NULL,
            parent_id TEXT,
            position INTEGER NOT NULL CHECK (position >= 0),
            is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_opened_at TEXT,
            FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE RESTRICT
        );

        CREATE INDEX pages_parent_position_idx
            ON pages(parent_id, position);

        CREATE TABLE documents (
            page_id TEXT PRIMARY KEY NOT NULL,
            content_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );

        CREATE TABLE settings (
            key TEXT PRIMARY KEY NOT NULL CHECK (length(key) > 0),
            value TEXT NOT NULL
        );
    "#,
    },
    Migration {
        version: 2,
        sql: r#"
        CREATE VIRTUAL TABLE page_search USING fts5(
            page_id UNINDEXED,
            title,
            body,
            tokenize = 'unicode61 remove_diacritics 2'
        );
    "#,
    },
    Migration {
        version: 3,
        sql: r#"
        ALTER TABLE pages ADD COLUMN deleted_at TEXT DEFAULT NULL;
        CREATE INDEX pages_deleted_at_idx
            ON pages(deleted_at);
    "#,
    },
];

#[derive(Debug)]
pub(crate) struct DatabaseError(String);

impl DatabaseError {
    pub(crate) fn message(message: impl Into<String>) -> Self {
        Self(message.into())
    }

    pub(crate) fn context(message: impl Display, error: impl Display) -> Self {
        Self(format!("{message}: {error}"))
    }
}

impl Display for DatabaseError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl Error for DatabaseError {}

impl From<rusqlite::Error> for DatabaseError {
    fn from(error: rusqlite::Error) -> Self {
        Self::context("SQLite operation failed", error)
    }
}

#[derive(Debug)]
pub(crate) struct DatabaseState {
    path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseStatus {
    database_path: String,
    schema_version: u32,
    sqlite_version: String,
    fts5_available: bool,
}

pub(crate) fn initialize(app_data_dir: &Path) -> Result<DatabaseState, DatabaseError> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        DatabaseError::context(
            "Could not create the LocalNote application data directory",
            error,
        )
    })?;

    let path = app_data_dir.join(DATABASE_FILENAME);
    let mut connection = open_connection(&path)?;
    migrate(&mut connection)?;
    verify_fts5(&connection)?;

    Ok(DatabaseState { path })
}

pub(crate) fn status(state: &DatabaseState) -> Result<DatabaseStatus, DatabaseError> {
    let connection = open_connection(&state.path)?;

    Ok(DatabaseStatus {
        database_path: state.path.to_string_lossy().into_owned(),
        schema_version: schema_version(&connection)?,
        sqlite_version: rusqlite::version().to_owned(),
        fts5_available: verify_fts5(&connection)?,
    })
}

pub(crate) fn connection(state: &DatabaseState) -> Result<Connection, DatabaseError> {
    open_connection(&state.path)
}

fn open_connection(path: &Path) -> Result<Connection, DatabaseError> {
    let connection = Connection::open(path)
        .map_err(|error| DatabaseError::context("Could not open the LocalNote database", error))?;

    // Foreign keys are connection-local. The timeout handles brief contention,
    // and WAL lets later autosave writes coexist with reads without blocking typing.
    connection.pragma_update(None, "foreign_keys", true)?;
    connection.busy_timeout(BUSY_TIMEOUT)?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    let journal_mode: String =
        connection.pragma_query_value(None, "journal_mode", |row| row.get(0))?;
    if !journal_mode.eq_ignore_ascii_case("wal") {
        return Err(DatabaseError(format!(
            "SQLite did not enable WAL journal mode (active mode: {journal_mode})"
        )));
    }

    Ok(connection)
}

fn migrate(connection: &mut Connection) -> Result<(), DatabaseError> {
    for (index, migration) in MIGRATIONS.iter().enumerate() {
        let expected_version = u32::try_from(index + 1)
            .map_err(|error| DatabaseError::context("Migration index is too large", error))?;
        if migration.version != expected_version {
            return Err(DatabaseError(format!(
                "Migration sequence is invalid: expected version {expected_version}, found {}",
                migration.version
            )));
        }
    }

    let current_version = schema_version(connection)?;
    let latest_version = MIGRATIONS.last().map_or(0, |migration| migration.version);

    if current_version > latest_version {
        return Err(DatabaseError(format!(
            "Database schema version {current_version} is newer than this LocalNote build supports ({latest_version})"
        )));
    }

    for migration in MIGRATIONS
        .iter()
        .filter(|migration| migration.version > current_version)
    {
        let transaction = connection.transaction().map_err(|error| {
            DatabaseError::context(
                format!("Could not start migration {}", migration.version),
                error,
            )
        })?;

        transaction.execute_batch(migration.sql).map_err(|error| {
            DatabaseError::context(format!("Migration {} failed", migration.version), error)
        })?;
        if migration.version == 2 {
            search::backfill(&transaction).map_err(|error| {
                DatabaseError::context("Migration 2 search backfill failed", error)
            })?;
        }
        transaction.pragma_update(None, "user_version", migration.version)?;
        transaction.commit().map_err(|error| {
            DatabaseError::context(
                format!("Could not commit migration {}", migration.version),
                error,
            )
        })?;
    }

    Ok(())
}

fn schema_version(connection: &Connection) -> Result<u32, DatabaseError> {
    connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(DatabaseError::from)
}

fn verify_fts5(connection: &Connection) -> Result<bool, DatabaseError> {
    let compiled: bool = connection.query_row(
        "SELECT sqlite_compileoption_used('ENABLE_FTS5')",
        [],
        |row| row.get(0),
    )?;

    if !compiled {
        return Err(DatabaseError(
            "The bundled SQLite library does not report FTS5 support".to_owned(),
        ));
    }

    connection
        .execute_batch(
            "CREATE VIRTUAL TABLE temp.localnote_fts5_check USING fts5(content);\
             DROP TABLE temp.localnote_fts5_check;",
        )
        .map_err(|error| {
            DatabaseError::context("The bundled SQLite FTS5 runtime check failed", error)
        })?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{documents, search};
    use rusqlite::{params, Error as SqliteError, ErrorCode};
    use tempfile::TempDir;

    fn test_database() -> (TempDir, DatabaseState) {
        let directory = TempDir::new().expect("temporary directory should be created");
        let state = initialize(directory.path()).expect("database should initialize");
        (directory, state)
    }

    #[test]
    fn creates_database_and_applies_migration_once() {
        let (directory, state) = test_database();
        assert!(state.path.exists());

        let connection = open_connection(&state.path).expect("database should reopen");
        assert_eq!(schema_version(&connection).unwrap(), 3);

        let tables: Vec<String> = connection
            .prepare(
                "SELECT name FROM sqlite_schema
                 WHERE type = 'table' AND name IN ('pages', 'documents', 'settings')
                 ORDER BY name",
            )
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(tables, ["documents", "pages", "settings"]);

        let repeated = initialize(directory.path()).expect("repeated initialization should work");
        let repeated_connection = open_connection(&repeated.path).unwrap();
        assert_eq!(schema_version(&repeated_connection).unwrap(), 3);
    }

    #[test]
    fn enforces_page_foreign_keys() {
        let (_directory, state) = test_database();
        let connection = open_connection(&state.path).unwrap();
        let error = connection
            .execute(
                "INSERT INTO pages
                 (id, title, parent_id, position, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 0, ?4, ?4)",
                params!["child", "Child", "missing", "2026-01-01T00:00:00Z"],
            )
            .unwrap_err();

        assert!(matches!(
            error,
            SqliteError::SqliteFailure(inner, _)
                if inner.code == ErrorCode::ConstraintViolation
        ));
    }

    #[test]
    fn reads_and_writes_phase_four_schema() {
        let (_directory, state) = test_database();
        let connection = open_connection(&state.path).unwrap();
        let timestamp = "2026-01-01T00:00:00Z";

        connection
            .execute(
                "INSERT INTO pages
                 (id, title, position, created_at, updated_at)
                 VALUES (?1, ?2, 0, ?3, ?3)",
                params!["page-1", "Test page", timestamp],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO documents (page_id, content_json, updated_at)
                 VALUES (?1, ?2, ?3)",
                params!["page-1", r#"[{"type":"paragraph"}]"#, timestamp],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                params!["theme", "system"],
            )
            .unwrap();

        let page_title: String = connection
            .query_row("SELECT title FROM pages WHERE id = 'page-1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        let document: String = connection
            .query_row(
                "SELECT content_json FROM documents WHERE page_id = 'page-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let setting: String = connection
            .query_row(
                "SELECT value FROM settings WHERE key = 'theme'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(page_title, "Test page");
        assert_eq!(document, r#"[{"type":"paragraph"}]"#);
        assert_eq!(setting, "system");
    }

    #[test]
    fn bundled_sqlite_supports_fts5() {
        let (_directory, state) = test_database();
        let database_status = status(&state).unwrap();

        assert_eq!(database_status.schema_version, 3);
        assert!(database_status.fts5_available);
    }

    #[test]
    fn failed_migration_does_not_advance_version() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("CREATE TABLE pages (id TEXT PRIMARY KEY);")
            .unwrap();
        let mut connection = connection;

        assert!(migrate(&mut connection).is_err());
        assert_eq!(schema_version(&connection).unwrap(), 0);
    }

    #[test]
    fn phase_two_migration_creates_and_backfills_search_without_touching_documents() {
        let directory = TempDir::new().unwrap();
        let path = directory.path().join(DATABASE_FILENAME);
        let phase_one_connection = open_connection(&path).unwrap();
        phase_one_connection
            .execute_batch(MIGRATIONS[0].sql)
            .unwrap();
        phase_one_connection
            .pragma_update(None, "user_version", 1)
            .unwrap();
        let timestamp = "2026-01-01T00:00:00.000Z";
        let valid_document = r#"[{"type":"paragraph","content":[{"type":"text","text":"backfilled body","styles":{}}]}]"#;
        let malformed_document = "{malformed";
        for (id, title, content) in [
            ("valid", "Existing title", valid_document),
            ("malformed", "Preserved title", malformed_document),
        ] {
            phase_one_connection
                .execute(
                    "INSERT INTO pages
                     (id, title, position, created_at, updated_at)
                     VALUES (?1, ?2, 0, ?3, ?3)",
                    params![id, title, timestamp],
                )
                .unwrap();
            phase_one_connection
                .execute(
                    "INSERT INTO documents (page_id, content_json, updated_at)
                     VALUES (?1, ?2, ?3)",
                    params![id, content, timestamp],
                )
                .unwrap();
        }
        drop(phase_one_connection);

        let state = initialize(directory.path()).unwrap();
        let connection = connection(&state).unwrap();
        assert_eq!(schema_version(&connection).unwrap(), 3);
        let search_table: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_schema
                 WHERE type = 'table' AND name = 'page_search'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(search_table, 1);
        assert_eq!(
            search::search(&state, "backfilled").unwrap()[0].page_id,
            "valid"
        );
        assert_eq!(
            search::search(&state, "Preserved").unwrap()[0].page_id,
            "malformed"
        );
        assert_eq!(
            documents::load(&state, "malformed")
                .unwrap()
                .content_json
                .as_deref(),
            Some(malformed_document)
        );
    }

    #[test]
    fn phase_three_migration_adds_deleted_at_column() {
        let (_directory, state) = test_database();
        let connection = connection(&state).unwrap();
        assert_eq!(schema_version(&connection).unwrap(), 3);

        connection
            .execute(
                "INSERT INTO pages (id, title, position, created_at, updated_at, deleted_at)
                 VALUES ('trashed-1', 'Trash note', 0, '2026-01-01', '2026-01-01', '2026-01-02')",
                [],
            )
            .unwrap();

        let deleted_at: Option<String> = connection
            .query_row(
                "SELECT deleted_at FROM pages WHERE id = 'trashed-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(deleted_at.as_deref(), Some("2026-01-02"));
    }
}
