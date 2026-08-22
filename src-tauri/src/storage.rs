use crate::database::DatabaseError;
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

const APP_DIRECTORY: &str = "LocalNote";
const DATA_DIRECTORY: &str = "Data";
const WEBVIEW_DIRECTORY: &str = "WebView";
const MAIN_WEBVIEW_DIRECTORY: &str = "main";
const DATABASE_FILENAME: &str = "localnote.db";
const BACKUP_DIRECTORY: &str = "LocalNote Notes";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoragePaths {
    pub(crate) data_root: PathBuf,
    pub(crate) database_path: PathBuf,
    pub(crate) webview_data_path: PathBuf,
    pub(crate) backup_path: PathBuf,
}

impl StoragePaths {
    fn from_roots(local_app_data: &Path, documents: &Path) -> Self {
        let data_root = local_app_data.join(APP_DIRECTORY);
        Self {
            database_path: data_root.join(DATA_DIRECTORY).join(DATABASE_FILENAME),
            webview_data_path: data_root
                .join(WEBVIEW_DIRECTORY)
                .join(MAIN_WEBVIEW_DIRECTORY),
            backup_path: documents.join(BACKUP_DIRECTORY),
            data_root,
        }
    }

    pub(crate) fn prepare_live_directories(&self) -> Result<(), DatabaseError> {
        let database_directory = self.database_path.parent().ok_or_else(|| {
            DatabaseError::message("The LocalNote database path has no parent directory")
        })?;

        for (description, directory) in [
            ("data", database_directory),
            ("WebView", self.webview_data_path.as_path()),
        ] {
            fs::create_dir_all(directory).map_err(|error| {
                DatabaseError::context(
                    format!("Could not create the LocalNote {description} directory"),
                    error,
                )
            })?;
        }

        Ok(())
    }
}

pub(crate) fn resolve(app: &AppHandle) -> Result<StoragePaths, DatabaseError> {
    let local_app_data = app.path().local_data_dir().map_err(|error| {
        DatabaseError::context(
            "Could not resolve the Windows Local AppData directory",
            error,
        )
    })?;
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| DatabaseError::context("Could not resolve Documents directory", error))?;

    Ok(StoragePaths::from_roots(&local_app_data, &documents))
}

pub(crate) fn ensure_backup_directory(paths: &StoragePaths) -> Result<&Path, DatabaseError> {
    fs::create_dir_all(&paths.backup_path)
        .map_err(|error| DatabaseError::context("Could not create backup directory", error))?;
    Ok(&paths.backup_path)
}

pub(crate) fn open_directory(path: &Path) -> Result<(), DatabaseError> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| DatabaseError::context("Could not open File Explorer", error))?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|error| DatabaseError::context("Could not open Finder", error))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| DatabaseError::context("Could not open file manager", error))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn builds_expected_paths_from_windows_roots() {
        let paths = StoragePaths::from_roots(
            Path::new(r"C:\Users\Ada\AppData\Local"),
            Path::new(r"C:\Users\Ada\Documents"),
        );

        assert_eq!(
            paths.data_root,
            PathBuf::from(r"C:\Users\Ada\AppData\Local\LocalNote")
        );
        assert_eq!(
            paths.database_path,
            PathBuf::from(r"C:\Users\Ada\AppData\Local\LocalNote\Data\localnote.db")
        );
        assert_eq!(
            paths.webview_data_path,
            PathBuf::from(r"C:\Users\Ada\AppData\Local\LocalNote\WebView\main")
        );
        assert_eq!(
            paths.backup_path,
            PathBuf::from(r"C:\Users\Ada\Documents\LocalNote Notes")
        );
    }

    #[test]
    fn prepares_only_the_live_data_directories() {
        let local_app_data = TempDir::new().unwrap();
        let documents = TempDir::new().unwrap();
        let paths = StoragePaths::from_roots(local_app_data.path(), documents.path());

        paths.prepare_live_directories().unwrap();

        assert!(paths.database_path.parent().unwrap().is_dir());
        assert!(paths.webview_data_path.is_dir());
        assert!(!paths.database_path.exists());
        assert!(!paths.backup_path.exists());
    }
}
