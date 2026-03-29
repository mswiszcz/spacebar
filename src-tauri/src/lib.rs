mod state;

use state::SessionStore;
use std::sync::Arc;

pub fn run() {
    let store = Arc::new(SessionStore::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(store)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
