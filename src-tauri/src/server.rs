use crate::state::{Session, SessionStore};
use axum::{
    extract::State as AxumState,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::TcpListener;

#[derive(Clone)]
struct AppState {
    store: Arc<SessionStore>,
    app_handle: AppHandle,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub agent: String,
    pub session_id: String,
    pub on_click: Option<String>,
    pub pwd: Option<String>,
    pub display_name: Option<String>,
    pub pid: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequest {
    pub session_id: String,
    pub state: String,
    #[serde(default)]
    pub no_sound: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionUpdateEvent {
    #[serde(flatten)]
    session: Session,
    no_sound: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveRequest {
    pub session_id: String,
}

async fn health() -> StatusCode {
    StatusCode::OK
}

async fn register(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<Session>, StatusCode> {
    let config = crate::config::load_config();
    let (session, group, is_new_group) = state.store.register(
        req.agent,
        req.session_id,
        req.on_click,
        req.pwd,
        req.display_name,
        req.pid,
        &config.group_renames,
    );
    // Show the main window when an agent registers
    if let Some(w) = state.app_handle.get_webview_window("main") {
        let _ = w.show();
    }
    let _ = state.app_handle.emit("session-added", &session);
    if is_new_group {
        let _ = state.app_handle.emit("group-added", &group);
    } else {
        let _ = state.app_handle.emit("group-updated", &group);
    }
    crate::rebuild_tray_menu(&state.app_handle, &state.store);
    Ok(Json(session))
}

async fn update(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<UpdateRequest>,
) -> Result<Json<Session>, StatusCode> {
    match state.store.update(&req.session_id, req.state) {
        Some(session) => {
            let event = SessionUpdateEvent { session: session.clone(), no_sound: req.no_sound };
            let _ = state.app_handle.emit("session-updated", &event);
            // Update the item text in-place to avoid dismissing an open tray menu.
            // Falls back to a full rebuild if the item doesn't exist yet.
            if !crate::update_tray_item_text(&state.app_handle, &state.store, &req.session_id) {
                crate::rebuild_tray_menu(&state.app_handle, &state.store);
            }
            Ok(Json(session))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn remove(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<RemoveRequest>,
) -> Result<Json<Session>, StatusCode> {
    match crate::commands::remove_session(&state.app_handle, &state.store, &req.session_id) {
        Some(session) => Ok(Json(session)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn start_server(store: Arc<SessionStore>, app_handle: AppHandle) -> u16 {
    let state = AppState { store, app_handle };

    let app = Router::new()
        .route("/health", get(health))
        .route("/register", post(register))
        .route("/update", post(update))
        .route("/remove", post(remove))
        .with_state(state);

    let config = crate::config::load_config();
    let bind_addr = &config.bind;

    let (listener, port) = match config.port {
        Some(p) => {
            // Try the persisted port first
            match TcpListener::bind(format!("{bind_addr}:{p}")).await {
                Ok(l) => (l, p),
                Err(_) => {
                    eprintln!("Warning: port {p} unavailable, falling back to random port");
                    let l = TcpListener::bind(format!("{bind_addr}:0")).await.unwrap();
                    let p = l.local_addr().unwrap().port();
                    (l, p)
                }
            }
        }
        None => {
            // First run — pick random port
            let l = TcpListener::bind(format!("{bind_addr}:0")).await.unwrap();
            let p = l.local_addr().unwrap().port();
            (l, p)
        }
    };

    // Persist port to config if it changed or was unset
    if config.port != Some(port) {
        let mut updated_config = crate::config::load_config();
        updated_config.port = Some(port);
        crate::config::save_config(&updated_config);
    }

    // Write port file for backward compatibility
    let port_file = dirs::home_dir().unwrap().join(".spacebar.port");
    std::fs::write(&port_file, port.to_string()).unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    port
}

/// Remove port file on shutdown
pub fn cleanup_port_file() {
    let port_file = dirs::home_dir().unwrap().join(".spacebar.port");
    let _ = std::fs::remove_file(port_file);
}
