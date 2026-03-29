mod commands;
mod config;
mod server;
mod state;

use config::load_config;
use state::SessionStore;
use std::sync::Arc;
use tauri::Manager;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

pub fn run() {
    let store = Arc::new(SessionStore::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(store.clone())
        .invoke_handler(tauri::generate_handler![
            commands::execute_click,
            commands::get_config,
            commands::save_config,
            commands::get_sessions,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            // Apply vibrancy
            let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None);

            // Load saved position
            let cfg = load_config();
            let _ = window.set_position(tauri::PhysicalPosition::new(
                cfg.position.x as i32,
                cfg.position.y as i32,
            ));
            let _ = window.set_always_on_top(cfg.always_on_top);

            // Start HTTP server
            let handle = app.handle().clone();
            let store_clone = store.clone();
            tauri::async_runtime::spawn(async move {
                let port = server::start_server(store_clone, handle).await;
                println!("Agent Monitor server listening on port {port}");
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                server::cleanup_port_file();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
