use crate::config::{self, Config};
use crate::state::SessionStore;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[tauri::command]
pub fn execute_click(session_id: String, store: State<'_, Arc<SessionStore>>) -> Result<(), String> {
    let session = store
        .get(&session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;

    Command::new("sh")
        .arg("-c")
        .arg(&session.on_click)
        .spawn()
        .map_err(|e| format!("Failed to execute click command: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn get_config() -> Config {
    config::load_config()
}

#[tauri::command]
pub fn save_config(config: Config) {
    config::save_config(&config);
}

#[tauri::command]
pub fn get_sessions(store: State<'_, Arc<SessionStore>>) -> Vec<crate::state::Session> {
    store.all()
}

#[tauri::command]
pub fn set_main_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| format!("Failed to set always on top: {e}"))
}

fn parse_material(name: &str) -> Option<NSVisualEffectMaterial> {
    match name {
        "Titlebar" => Some(NSVisualEffectMaterial::Titlebar),
        "Selection" => Some(NSVisualEffectMaterial::Selection),
        "Menu" => Some(NSVisualEffectMaterial::Menu),
        "Popover" => Some(NSVisualEffectMaterial::Popover),
        "Sidebar" => Some(NSVisualEffectMaterial::Sidebar),
        "HeaderView" => Some(NSVisualEffectMaterial::HeaderView),
        "Sheet" => Some(NSVisualEffectMaterial::Sheet),
        "WindowBackground" => Some(NSVisualEffectMaterial::WindowBackground),
        "HudWindow" => Some(NSVisualEffectMaterial::HudWindow),
        "FullScreenUI" => Some(NSVisualEffectMaterial::FullScreenUI),
        "Tooltip" => Some(NSVisualEffectMaterial::Tooltip),
        "ContentBackground" => Some(NSVisualEffectMaterial::ContentBackground),
        "UnderWindowBackground" => Some(NSVisualEffectMaterial::UnderWindowBackground),
        "UnderPageBackground" => Some(NSVisualEffectMaterial::UnderPageBackground),
        _ => None,
    }
}

#[tauri::command]
pub fn apply_window_vibrancy(app: AppHandle, material: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    if material == "None" {
        clear_vibrancy(&window)
            .map(|_| ())
            .map_err(|e| format!("Failed to clear vibrancy: {e}"))
    } else {
        let mat = parse_material(&material)
            .ok_or_else(|| format!("Unknown material: {material}"))?;
        apply_vibrancy(&window, mat, Some(NSVisualEffectState::Active), None)
            .map_err(|e| format!("Failed to apply vibrancy: {e}"))
    }
}
