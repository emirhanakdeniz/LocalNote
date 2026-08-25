mod database;
mod documents;
mod export;
mod import;
mod pages;
mod search;
mod settings;
mod storage;

use database::{DatabaseState, DatabaseStatus};
use documents::Document;
use pages::Page;
use search::SearchResult;
use std::sync::{Arc, Mutex};
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
fn backup_notes(
    paths: tauri::State<'_, storage::StoragePaths>,
    notes: Vec<export::BackupNoteItem>,
) -> Result<export::BackupResult, String> {
    export::backup_notes(&paths, notes).map_err(|error| error.to_string())
}

#[tauri::command]
fn select_markdown_files(app: tauri::AppHandle) -> Result<Vec<import::MarkdownSource>, String> {
    import::select_markdown_files(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_markdown_notes(
    state: tauri::State<'_, DatabaseState>,
    notes: Vec<import::ImportNoteItem>,
) -> Result<import::ImportResult, String> {
    import::import_notes(&state, notes).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_backup_folder(paths: tauri::State<'_, storage::StoragePaths>) -> Result<(), String> {
    export::open_backup_folder(&paths).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_storage_info(paths: tauri::State<'_, storage::StoragePaths>) -> storage::StoragePaths {
    paths.inner().clone()
}

#[tauri::command]
fn open_data_folder(paths: tauri::State<'_, storage::StoragePaths>) -> Result<(), String> {
    storage::open_directory(&paths.data_root).map_err(|error| error.to_string())
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

fn restore_saved_window_state(
    window: &tauri::WebviewWindow,
    saved: &settings::SavedWindowState,
) {
    let monitors = window.available_monitors().unwrap_or_default();

    let target_monitor = monitors
        .iter()
        .find(|mon| {
            let pos = mon.position();
            let size = mon.size();
            let mon_left = pos.x;
            let mon_top = pos.y;
            let mon_right = mon_left + size.width as i32;
            let mon_bottom = mon_top + size.height as i32;

            let win_left = saved.x;
            let win_top = saved.y;
            let win_right = saved.x + saved.width as i32;
            let win_bottom = saved.y + saved.height as i32;

            win_left < mon_right && win_right > mon_left && win_top < mon_bottom && win_bottom > mon_top
        })
        .or_else(|| monitors.first());

    let (x, y, width, height) = if let Some(mon) = target_monitor {
        let mon_pos = mon.position();
        let mon_size = mon.size();
        let mon_left = mon_pos.x;
        let mon_top = mon_pos.y;
        let mon_right = mon_left + mon_size.width as i32;
        let mon_bottom = mon_top + mon_size.height as i32;

        let max_w = mon_size.width.max(640);
        let max_h = mon_size.height.max(480);
        let w = saved.width.clamp(640, max_w);
        let h = saved.height.clamp(480, max_h);

        let clamped_x = saved.x.clamp(mon_left, (mon_right - w as i32).max(mon_left));
        let clamped_y = saved.y.clamp(mon_top, (mon_bottom - h as i32).max(mon_top));

        (clamped_x, clamped_y, w, h)
    } else {
        (
            saved.x,
            saved.y,
            saved.width.max(640),
            saved.height.max(480),
        )
    };

    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(width, height)));
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));

    if saved.is_maximized {
        let _ = window.maximize();
    }
}

fn track_window_state(
    window: &tauri::WebviewWindow,
    app_handle: tauri::AppHandle,
    saved_state: Option<settings::SavedWindowState>,
) {
    let initial_state = saved_state.unwrap_or_else(|| {
        let pos = window.outer_position().unwrap_or(tauri::PhysicalPosition::new(0, 0));
        let size = window.inner_size().unwrap_or(tauri::PhysicalSize::new(1100, 760));
        let is_maximized = window.is_maximized().unwrap_or(false);
        settings::SavedWindowState {
            x: pos.x,
            y: pos.y,
            width: size.width.max(640),
            height: size.height.max(480),
            is_maximized,
        }
    });

    let current_state = Arc::new(Mutex::new(initial_state));
    let current_state_clone = current_state.clone();
    let window_clone = window.clone();

    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Moved(pos) => {
            if let Ok(is_max) = window_clone.is_maximized() {
                if !is_max {
                    if let Ok(mut state) = current_state_clone.lock() {
                        state.x = pos.x;
                        state.y = pos.y;
                        state.is_maximized = false;
                        if let Some(db) = app_handle.try_state::<DatabaseState>() {
                            let _ = settings::set_window_state(&db, *state);
                        }
                    }
                }
            }
        }
        tauri::WindowEvent::Resized(size) => {
            if let Ok(is_max) = window_clone.is_maximized() {
                if !is_max && size.width > 0 && size.height > 0 {
                    if let Ok(mut state) = current_state_clone.lock() {
                        state.width = size.width;
                        state.height = size.height;
                        state.is_maximized = false;
                        if let Some(db) = app_handle.try_state::<DatabaseState>() {
                            let _ = settings::set_window_state(&db, *state);
                        }
                    }
                } else if is_max {
                    if let Ok(mut state) = current_state_clone.lock() {
                        state.is_maximized = true;
                        if let Some(db) = app_handle.try_state::<DatabaseState>() {
                            let _ = settings::set_window_state(&db, *state);
                        }
                    }
                }
            }
        }
        tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
            if let Ok(is_max) = window_clone.is_maximized() {
                if let Ok(mut state) = current_state_clone.lock() {
                    state.is_maximized = is_max;
                    if !is_max {
                        if let Ok(pos) = window_clone.outer_position() {
                            state.x = pos.x;
                            state.y = pos.y;
                        }
                        if let Ok(size) = window_clone.inner_size() {
                            if size.width > 0 && size.height > 0 {
                                state.width = size.width;
                                state.height = size.height;
                            }
                        }
                    }
                    if let Some(db) = app_handle.try_state::<DatabaseState>() {
                        let _ = settings::set_window_state(&db, *state);
                    }
                }
            }
        }
        _ => {}
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let storage_paths = storage::resolve(app.handle())?;
            storage_paths.prepare_live_directories()?;
            let database_state = database::initialize(&storage_paths.database_path)?;

            let saved_state = settings::get_window_state(&database_state).ok().flatten();

            let window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|config| config.label == "main")
                .cloned()
                .ok_or("The main window configuration is missing")?;

            let window = tauri::WebviewWindowBuilder::from_config(app, &window_config)?
                .data_directory(storage_paths.webview_data_path.clone())
                .build()?;

            if let Some(ref saved) = saved_state {
                restore_saved_window_state(&window, saved);
            }

            track_window_state(&window, app.handle().clone(), saved_state);
            app.manage(database_state);
            app.manage(storage_paths);

            #[cfg(windows)]
            window.with_webview(|webview| unsafe {
                if let Ok(core_webview) = webview.controller().CoreWebView2() {
                    if let Ok(settings) = core_webview.Settings() {
                        let _ = settings.SetAreDefaultContextMenusEnabled(false);
                    }
                }
            })?;

            window.show()?;
            let _ = window.set_focus();
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
            backup_notes,
            select_markdown_files,
            import_markdown_notes,
            open_backup_folder,
            get_storage_info,
            open_data_folder,
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
