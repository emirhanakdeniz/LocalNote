mod database;
mod documents;
mod export;
mod pages;
mod search;
mod settings;

use database::{DatabaseState, DatabaseStatus};
use documents::Document;
use pages::Page;
use search::SearchResult;
use tauri::Manager;

#[tauri::command]
fn database_status(state: tauri::State<'_, DatabaseState>) -> Result<DatabaseStatus, String> {
    database::status(&state).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_pages(state: tauri::State<'_, DatabaseState>) -> Result<Vec<Page>, String> {
    pages::list(&state).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_page(
    state: tauri::State<'_, DatabaseState>,
    parent_id: Option<String>,
) -> Result<Page, String> {
    pages::create(&state, parent_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_page(
    state: tauri::State<'_, DatabaseState>,
    id: String,
    title: String,
) -> Result<Page, String> {
    pages::rename(&state, &id, &title).map_err(|error| error.to_string())
}

#[tauri::command]
fn move_page(
    state: tauri::State<'_, DatabaseState>,
    id: String,
    parent_id: Option<String>,
    position: usize,
) -> Result<Vec<Page>, String> {
    pages::move_page(&state, &id, parent_id, position).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_page(state: tauri::State<'_, DatabaseState>, id: String) -> Result<Vec<Page>, String> {
    pages::delete(&state, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_page(state: tauri::State<'_, DatabaseState>, id: String) -> Result<Page, String> {
    pages::open(&state, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_page_favorite(
    state: tauri::State<'_, DatabaseState>,
    id: String,
    is_favorite: bool,
) -> Result<Page, String> {
    pages::set_favorite(&state, &id, is_favorite).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_document(
    state: tauri::State<'_, DatabaseState>,
    page_id: String,
) -> Result<Document, String> {
    documents::load(&state, &page_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_document(
    state: tauri::State<'_, DatabaseState>,
    page_id: String,
    content_json: String,
) -> Result<Document, String> {
    documents::save(&state, &page_id, &content_json).map_err(|error| error.to_string())
}

#[tauri::command]
fn search_pages(
    state: tauri::State<'_, DatabaseState>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    search::search(&state, &query).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_markdown(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseState>,
    page_id: String,
    content_json: Option<String>,
    markdown: String,
) -> Result<export::ExportResult, String> {
    export::export_markdown(&app, &state, &page_id, content_json.as_deref(), &markdown)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_theme(state: tauri::State<'_, DatabaseState>) -> Result<settings::ThemePreference, String> {
    settings::get_theme(&state).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_theme(
    state: tauri::State<'_, DatabaseState>,
    preference: settings::ThemePreference,
) -> Result<settings::ThemePreference, String> {
    settings::set_theme(&state, preference).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_spellcheck(
    state: tauri::State<'_, DatabaseState>,
) -> Result<settings::SpellcheckPreference, String> {
    settings::get_spellcheck(&state).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_spellcheck(
    state: tauri::State<'_, DatabaseState>,
    preference: settings::SpellcheckPreference,
) -> Result<settings::SpellcheckPreference, String> {
    settings::set_spellcheck(&state, preference).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_accent_color(state: tauri::State<'_, DatabaseState>) -> Result<String, String> {
    settings::get_accent_color(&state).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_accent_color(
    state: tauri::State<'_, DatabaseState>,
    hex: String,
) -> Result<String, String> {
    settings::set_accent_color(&state, &hex).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_trash(state: tauri::State<'_, DatabaseState>) -> Result<Vec<Page>, String> {
    pages::list_trash(&state).map_err(|error| error.to_string())
}

#[tauri::command]
fn restore_page(state: tauri::State<'_, DatabaseState>, id: String) -> Result<Vec<Page>, String> {
    pages::restore(&state, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_page_permanently(
    state: tauri::State<'_, DatabaseState>,
    id: String,
) -> Result<Vec<Page>, String> {
    pages::delete_permanently(&state, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn empty_trash(state: tauri::State<'_, DatabaseState>) -> Result<(), String> {
    pages::empty_trash(&state).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let database_state = database::initialize(&app_data_dir)?;
            app.manage(database_state);

            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                window.with_webview(|webview| unsafe {
                    if let Ok(core_webview) = webview.controller().CoreWebView2() {
                        if let Ok(settings) = core_webview.Settings() {
                            let _ = settings.SetAreDefaultContextMenusEnabled(false);
                        }
                    }
                })?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            database_status,
            list_pages,
            create_page,
            rename_page,
            move_page,
            delete_page,
            open_page,
            set_page_favorite,
            load_document,
            save_document,
            search_pages,
            export_markdown,
            get_theme,
            set_theme,
            get_spellcheck,
            set_spellcheck,
            get_accent_color,
            set_accent_color,
            list_trash,
            restore_page,
            delete_page_permanently,
            empty_trash
        ])
        .run(tauri::generate_context!())
        .expect("error while running LocalNote");
}
