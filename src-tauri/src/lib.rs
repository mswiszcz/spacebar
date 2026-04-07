#![allow(unexpected_cfgs)]

mod blur;
mod commands;
mod config;
mod server;
mod state;
mod split_view;

use config::load_config;
use state::SessionStore;
use std::process::Command;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager};
use blur::set_window_blur_radius;

pub fn rebuild_tray_menu(app: &AppHandle, store: &SessionStore) {
    let groups = store.all_groups();

    let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();

    for group in &groups {
        if let Some(ref name) = group.display_name {
            let header = MenuItem::with_id(
                app,
                &format!("group-{}", group.group_id),
                name,
                false,
                None::<&str>,
            )
            .unwrap();
            items.push(Box::new(header));
        }

        for sid in &group.session_ids {
            if let Some(session) = store.get(sid) {
                let label = if group.display_name.is_some() {
                    format!("  {} ({}) · {}", session.agent, session.session_id, session.state)
                } else {
                    format!("{} ({}) · {}", session.agent, session.session_id, session.state)
                };
                let item = MenuItem::with_id(app, &session.session_id, &label, true, None::<&str>).unwrap();
                items.push(Box::new(item));
            }
        }

        items.push(Box::new(PredefinedMenuItem::separator(app).unwrap()));
    }

    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>).unwrap();
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>).unwrap();
    let reset_pos = MenuItem::with_id(app, "reset-position", "Reset Position", true, None::<&str>).unwrap();
    let preferences = MenuItem::with_id(app, "preferences", "Preferences...", true, Some("cmd+,")).unwrap();
    let separator = PredefinedMenuItem::separator(app).unwrap();
    let quit = PredefinedMenuItem::quit(app, Some("Quit Spacebar")).unwrap();

    items.push(Box::new(show));
    items.push(Box::new(hide));
    items.push(Box::new(reset_pos));
    items.push(Box::new(preferences));
    items.push(Box::new(separator));
    items.push(Box::new(quit));

    let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = items.iter().map(|i| i.as_ref()).collect();
    let menu = Menu::with_items(app, &refs).unwrap();

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_menu(Some(menu));
    }
}

pub fn run() {
    let store = Arc::new(SessionStore::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(store.clone())
        .invoke_handler(tauri::generate_handler![
            commands::execute_click,
            commands::get_config,
            commands::save_config,
            commands::get_sessions,
            commands::get_groups,
            commands::rename_group,
            commands::set_main_always_on_top,
            commands::set_blur_radius,
            commands::pick_sound_file,
            commands::save_position,
            commands::get_version,
            commands::toggle_split_view,
            commands::is_split_view,
            commands::is_on_fullscreen_space,
            commands::restore_after_split_view,
        ])
        .setup(move |app| {
            // Hide from Dock — tray-only app
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_webview_window("main").unwrap();

            // Start with window hidden — it will show when the first agent registers
            let _ = window.hide();

            // Load saved config
            let cfg = load_config();

            // Apply background blur (private macOS API, same as iTerm2)
            let _ = set_window_blur_radius(&window, cfg.theme.blur_radius);

            // Configure window for Split View eligibility
            split_view::configure_for_split_view(&window);
            let _ = window.set_position(tauri::PhysicalPosition::new(
                cfg.position.x as i32,
                cfg.position.y as i32,
            ));
            let _ = window.set_always_on_top(cfg.always_on_top);

            // Configure tooltip window
            if let Some(tooltip_window) = app.get_webview_window("tooltip") {
                let _ = tooltip_window.set_ignore_cursor_events(true);
                let _ = tooltip_window.set_always_on_top(cfg.always_on_top);
                let _ = set_window_blur_radius(&tooltip_window, 20);
            }

            // Build tray menu
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let reset_pos = MenuItem::with_id(app, "reset-position", "Reset Position", true, None::<&str>)?;
            let preferences = MenuItem::with_id(app, "preferences", "Preferences...", true, Some("cmd+,"))?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("Quit Spacebar"))?;

            let menu = Menu::with_items(app, &[&show, &hide, &reset_pos, &preferences, &separator, &quit])?;

            let store_for_tray = store.clone();
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Spacebar")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        // Only show window if there are active agents
                        if !store_for_tray.all().is_empty() {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "reset-position" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.set_position(tauri::PhysicalPosition::new(100, 100));
                            let _ = w.show();
                            let _ = w.set_focus();
                            // Persist reset position
                            let mut cfg = load_config();
                            cfg.position.x = 100.0;
                            cfg.position.y = 100.0;
                            cfg.snap.snapped_edge = None;
                            config::save_config(&cfg);
                            let _ = app.emit("config-changed", &cfg);
                        }
                    }
                    "preferences" => {
                        commands::open_preferences(app.clone());
                    }
                    id if id.starts_with("group-") => {}
                    id => {
                        if let Some(session) = store_for_tray.get(id) {
                            if let Some(ref on_click) = session.on_click {
                                let _ = Command::new("sh")
                                    .arg("-c")
                                    .arg(on_click)
                                    .spawn();
                            }
                        }
                    }
                })
                .on_tray_icon_event(move |_tray, _event| {
                    // Menu opens automatically on click — no need to show/focus the main window here.
                    // Doing so steals focus from the tray menu, causing it to dismiss instantly
                    // (especially visible when the app is on a different screen).
                })
                .build(app)?;

            // Start HTTP server
            let handle = app.handle().clone();
            let store_clone = store.clone();
            tauri::async_runtime::spawn(async move {
                let port = server::start_server(store_clone, handle).await;
                println!("Spacebar server listening on port {port}");
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of close — keep app running in tray (main window only)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    server::cleanup_port_file();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
