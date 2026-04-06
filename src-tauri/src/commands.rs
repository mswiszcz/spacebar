use crate::config::{self, Config};
use crate::state::SessionStore;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn execute_click(session_id: String, store: State<'_, Arc<SessionStore>>) -> Result<(), String> {
    let session = store
        .get(&session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;

    let on_click = session
        .on_click
        .as_deref()
        .ok_or_else(|| format!("Session {session_id} has no on_click command"))?;

    Command::new("sh")
        .arg("-c")
        .arg(on_click)
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
        .map_err(|e| format!("Failed to set always on top: {e}"))?;

    if let Some(tooltip) = app.get_webview_window("tooltip") {
        let _ = tooltip.set_always_on_top(always_on_top);
    }

    Ok(())
}

#[tauri::command]
pub fn pick_sound_file(app: AppHandle) -> Option<String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Audio", &["wav", "mp3", "ogg"])
        .blocking_pick_file();
    file.and_then(|f| f.as_path().map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn get_groups(store: State<'_, Arc<SessionStore>>) -> Vec<crate::state::Group> {
    store.all_groups()
}

#[tauri::command]
pub fn rename_group(
    app: AppHandle,
    group_id: String,
    display_name: String,
    store: State<'_, Arc<SessionStore>>,
) -> Result<(), String> {
    let group = store
        .rename_group(&group_id, display_name.clone())
        .ok_or_else(|| format!("Group {group_id} not found"))?;

    // Persist rename mapping
    if let Some(ref pwd) = group.pwd {
        let mut cfg = config::load_config();
        cfg.group_renames.insert(pwd.clone(), display_name);
        config::save_config(&cfg);
    }

    let _ = app.emit("group-updated", &group);
    crate::rebuild_tray_menu(&app, &store);
    Ok(())
}

#[tauri::command]
pub fn save_position(x: f64, y: f64) {
    let mut cfg = config::load_config();
    cfg.position.x = x;
    cfg.position.y = y;
    config::save_config(&cfg);
}

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn set_blur_radius(app: AppHandle, radius: u32) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    crate::blur::set_window_blur_radius(&window, radius)
}

#[allow(deprecated, unexpected_cfgs)]
#[tauri::command]
pub fn toggle_split_view(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    let entering = !crate::split_view::is_fullscreen(&window);

    if entering {
        window.set_resizable(true).map_err(|e| format!("{e}"))?;
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    } else {
        window.set_resizable(false).map_err(|e| format!("{e}"))?;
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }

    unsafe {
        use objc::{msg_send, sel, sel_impl};
        let ns_window = window.ns_window().map_err(|e| format!("{e}"))? as cocoa::base::id;
        let _: () = msg_send![ns_window, toggleFullScreen: cocoa::base::nil];
    }

    Ok(())
}

#[tauri::command]
pub fn is_split_view(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    Ok(crate::split_view::is_fullscreen(&window))
}
