mod server;
mod state;

use state::SessionStore;
use std::sync::Arc;

pub fn run() {
    let store = Arc::new(SessionStore::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(store.clone())
        .setup(move |app| {
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
