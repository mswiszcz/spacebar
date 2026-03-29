mod commands;
mod config;
mod server;
mod state;

use config::load_config;
use state::SessionStore;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

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
            commands::set_main_always_on_top,
            commands::apply_window_vibrancy,
        ])
        .setup(move |app| {
            // Hide from Dock — tray-only app
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_webview_window("main").unwrap();

            // Load saved config
            let cfg = load_config();

            // Apply vibrancy with configured material
            if cfg.theme.vibrancy_material != "None" {
                let mat = match cfg.theme.vibrancy_material.as_str() {
                    "Titlebar" => NSVisualEffectMaterial::Titlebar,
                    "Selection" => NSVisualEffectMaterial::Selection,
                    "Menu" => NSVisualEffectMaterial::Menu,
                    "Popover" => NSVisualEffectMaterial::Popover,
                    "Sidebar" => NSVisualEffectMaterial::Sidebar,
                    "HeaderView" => NSVisualEffectMaterial::HeaderView,
                    "Sheet" => NSVisualEffectMaterial::Sheet,
                    "WindowBackground" => NSVisualEffectMaterial::WindowBackground,
                    "FullScreenUI" => NSVisualEffectMaterial::FullScreenUI,
                    "Tooltip" => NSVisualEffectMaterial::Tooltip,
                    "ContentBackground" => NSVisualEffectMaterial::ContentBackground,
                    "UnderWindowBackground" => NSVisualEffectMaterial::UnderWindowBackground,
                    "UnderPageBackground" => NSVisualEffectMaterial::UnderPageBackground,
                    _ => NSVisualEffectMaterial::HudWindow,
                };
                let _ = apply_vibrancy(&window, mat, Some(NSVisualEffectState::Active), None);
            }
            let _ = window.set_position(tauri::PhysicalPosition::new(
                cfg.position.x as i32,
                cfg.position.y as i32,
            ));
            let _ = window.set_always_on_top(cfg.always_on_top);

            // Build tray menu
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("Quit Agent Monitor"))?;

            let menu = Menu::with_items(app, &[&show, &hide, &separator, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Agent Monitor")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Start HTTP server
            let handle = app.handle().clone();
            let store_clone = store.clone();
            tauri::async_runtime::spawn(async move {
                let port = server::start_server(store_clone, handle).await;
                println!("Agent Monitor server listening on port {port}");
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of close — keep app running in tray
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
            if let tauri::WindowEvent::Destroyed = event {
                server::cleanup_port_file();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
