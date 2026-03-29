# Agent Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS dock-like floating bar (Tauri v2) that shows animated SVG mascots representing running AI agents, connected via a CLI sidecar that agent hooks call.

**Architecture:** Tauri v2 app with a Rust backend running an embedded HTTP server (axum). A CLI sidecar binary (`agentmonitor`) sends commands to the HTTP server. The webview frontend renders mascots as inline SVG with CSS animations, receiving state updates via Tauri events.

**Tech Stack:** Tauri v2, Rust, axum, TypeScript (vanilla), CSS/SVG animations, window-vibrancy crate

**Spec:** `docs/superpowers/specs/2026-03-29-agent-monitor-design.md`

---

## File Structure

```
agent-monitor/
├── Cargo.toml                          # Workspace root
├── package.json                        # Frontend deps (typescript, vite)
├── tsconfig.json
├── vite.config.ts
├── index.html                          # Vite entry point
├── src/                                # Frontend source
│   ├── main.ts                         # Entry: listen to Tauri events, render grid
│   ├── state.ts                        # Frontend session state store
│   ├── mascot-grid.ts                  # Renders mascot grid (h/v), entry/exit anims
│   ├── preferences.ts                  # Right-click preferences popover
│   ├── tooltip.ts                      # Hover tooltip component
│   ├── sound.ts                        # Sound playback manager
│   ├── styles.css                      # Base styles, animations, glass effect
│   └── mascots/
│       ├── types.ts                    # MascotDefinition interface
│       ├── claude-code.ts              # Claude Code SVG + CSS per state
│       └── registry.ts                 # Agent name → mascot lookup
├── sounds/                             # .wav files bundled as Tauri resources
│   ├── enter.wav
│   ├── exit.wav
│   ├── tick.wav
│   ├── ping.wav
│   ├── buzz.wav
│   ├── squeeze.wav
│   └── bell.wav
├── src-tauri/
│   ├── Cargo.toml                      # Tauri app crate
│   ├── tauri.conf.json                 # Window, sidecar, resource config
│   ├── capabilities/
│   │   └── default.json                # Permissions for shell, sidecar
│   ├── build.rs                        # Tauri build script
│   └── src/
│       ├── main.rs                     # Tauri entry point
│       ├── lib.rs                      # Builder setup: commands, plugins, server spawn
│       ├── state.rs                    # SessionStore: HashMap<String, Session>
│       ├── server.rs                   # Axum HTTP server (/register, /update, /remove, /health)
│       ├── config.rs                   # Load/save ~/.agentmonitor/config.json
│       └── commands.rs                 # Tauri commands: execute_click, get/save config
├── cli/
│   ├── Cargo.toml                      # CLI sidecar crate
│   └── src/
│       └── main.rs                     # CLI: register, update, remove, health subcommands
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `Cargo.toml` (workspace)
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `cli/Cargo.toml`
- Create: `cli/src/main.rs`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Initialize the project with Cargo workspace**

Create workspace `Cargo.toml`:

```toml
[workspace]
members = ["src-tauri", "cli"]
resolver = "2"
```

- [ ] **Step 2: Create the Tauri app crate**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "agent-monitor"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
axum = "0.8"
window-vibrancy = "0.5"
dirs = "6"
```

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

Create `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    agent_monitor::run()
}
```

Create `src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Create the CLI sidecar crate**

Create `cli/Cargo.toml`:

```toml
[package]
name = "agentmonitor"
version = "0.1.0"
edition = "2021"

[dependencies]
clap = { version = "4", features = ["derive"] }
ureq = { version = "3", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dirs = "6"
```

Create `cli/src/main.rs`:

```rust
fn main() {
    println!("agentmonitor cli placeholder");
}
```

- [ ] **Step 4: Create the frontend scaffolding**

Create `package.json`:

```json
{
  "name": "agent-monitor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "typescript": "^5.6",
    "vite": "^6"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-shell": "^2"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
```

Create `vite.config.ts`:

```typescript
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Monitor</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app" data-tauri-drag-region></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/styles.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  background: transparent;
  overflow: hidden;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

#app {
  width: 100vw;
  height: 100vh;
}
```

Create `src/main.ts`:

```typescript
console.log("Agent Monitor loaded");
```

- [ ] **Step 5: Configure Tauri window and sidecar**

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicoverbruggen/tauri-v2-schema/main/tauri.conf.json",
  "productName": "Agent Monitor",
  "version": "0.1.0",
  "identifier": "com.agentmonitor.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev"
  },
  "app": {
    "windows": [
      {
        "title": "Agent Monitor",
        "width": 200,
        "height": 80,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "resizable": false,
        "skipTaskbar": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["../sounds/*"],
    "externalBin": ["../cli/target/release/agentmonitor"]
  },
  "plugins": {
    "shell": {
      "open": true
    }
  }
}
```

Create `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "description": "Default capabilities for Agent Monitor",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-set-always-on-top",
    "core:window:allow-center",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "../cli/target/release/agentmonitor",
          "sidecar": true
        }
      ]
    },
    "shell:allow-open"
  ]
}
```

- [ ] **Step 6: Install dependencies and verify the project compiles**

Run:
```bash
npm install
cd src-tauri && cargo check && cd ..
cd cli && cargo check && cd ..
```

Expected: No compilation errors.

- [ ] **Step 7: Commit**

```bash
git init
echo 'node_modules/\ntarget/\ndist/\n.superpowers/' > .gitignore
git add .
git commit -m "feat: scaffold Tauri v2 project with workspace and CLI crate"
```

---

### Task 2: Session State Management (Rust Backend)

**Files:**
- Create: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write tests for SessionStore**

Add to `src-tauri/src/state.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub session_id: String,
    pub agent: String,
    pub state: String,
    pub on_click: String,
    pub registered_at: u64,
}

#[derive(Debug, Default)]
pub struct SessionStore {
    sessions: Mutex<HashMap<String, Session>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, agent: String, session_id: String, on_click: String) -> Session {
        let session = Session {
            session_id: session_id.clone(),
            agent,
            state: "entering".to_string(),
            on_click,
            registered_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
        self.sessions
            .lock()
            .unwrap()
            .insert(session_id, session.clone());
        session
    }

    pub fn update(&self, session_id: &str, state: String) -> Option<Session> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.state = state;
            Some(session.clone())
        } else {
            None
        }
    }

    pub fn remove(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().remove(session_id)
    }

    pub fn get(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(session_id).cloned()
    }

    pub fn all(&self) -> Vec<Session> {
        self.sessions.lock().unwrap().values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_creates_session_with_entering_state() {
        let store = SessionStore::new();
        let session = store.register(
            "claude-code".into(),
            "sess-1".into(),
            "wsh view focus".into(),
        );
        assert_eq!(session.session_id, "sess-1");
        assert_eq!(session.agent, "claude-code");
        assert_eq!(session.state, "entering");
        assert_eq!(session.on_click, "wsh view focus");
        assert!(session.registered_at > 0);
    }

    #[test]
    fn test_update_changes_state() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "sess-1".into(), "cmd".into());
        let updated = store.update("sess-1", "thinking".into());
        assert_eq!(updated.unwrap().state, "thinking");
    }

    #[test]
    fn test_update_nonexistent_returns_none() {
        let store = SessionStore::new();
        assert!(store.update("nope", "thinking".into()).is_none());
    }

    #[test]
    fn test_remove_returns_session_and_deletes() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "sess-1".into(), "cmd".into());
        let removed = store.remove("sess-1");
        assert!(removed.is_some());
        assert!(store.get("sess-1").is_none());
    }

    #[test]
    fn test_all_returns_all_sessions() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "s1".into(), "cmd".into());
        store.register("claude-code".into(), "s2".into(), "cmd".into());
        assert_eq!(store.all().len(), 2);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd src-tauri && cargo test`

Expected: All 5 tests pass.

- [ ] **Step 3: Wire state into Tauri builder**

Update `src-tauri/src/lib.rs`:

```rust
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
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat: add SessionStore with register/update/remove and tests"
```

---

### Task 3: HTTP Server (Rust Backend)

**Files:**
- Create: `src-tauri/src/server.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement the axum HTTP server**

Create `src-tauri/src/server.rs`:

```rust
use crate::state::{Session, SessionStore};
use axum::{
    extract::State as AxumState,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
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
    pub on_click: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequest {
    pub session_id: String,
    pub state: String,
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
    let session = state
        .store
        .register(req.agent, req.session_id, req.on_click);
    let _ = state.app_handle.emit("session-added", &session);
    Ok(Json(session))
}

async fn update(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<UpdateRequest>,
) -> Result<Json<Session>, StatusCode> {
    match state.store.update(&req.session_id, req.state) {
        Some(session) => {
            let _ = state.app_handle.emit("session-updated", &session);
            Ok(Json(session))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn remove(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<RemoveRequest>,
) -> Result<Json<Session>, StatusCode> {
    match state.store.remove(&req.session_id) {
        Some(session) => {
            let _ = state.app_handle.emit("session-removed", &session);
            Ok(Json(session))
        }
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

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    // Write port file
    let port_file = dirs::home_dir().unwrap().join(".agentmonitor.port");
    std::fs::write(&port_file, port.to_string()).unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    port
}

/// Remove port file on shutdown
pub fn cleanup_port_file() {
    let port_file = dirs::home_dir().unwrap().join(".agentmonitor.port");
    let _ = std::fs::remove_file(port_file);
}
```

- [ ] **Step 2: Wire the server into Tauri startup**

Update `src-tauri/src/lib.rs`:

```rust
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
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/server.rs src-tauri/src/lib.rs
git commit -m "feat: add axum HTTP server with register/update/remove endpoints"
```

---

### Task 4: CLI Sidecar

**Files:**
- Modify: `cli/src/main.rs`

- [ ] **Step 1: Implement the CLI with clap subcommands**

Replace `cli/src/main.rs`:

```rust
use clap::{Parser, Subcommand};
use serde::Serialize;
use std::fs;
use std::process;

#[derive(Parser)]
#[command(name = "agentmonitor", about = "CLI for Agent Monitor")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Register a new agent session
    Register {
        #[arg(long)]
        agent: String,
        #[arg(long)]
        session_id: String,
        #[arg(long)]
        on_click: String,
    },
    /// Update an agent's state
    Update {
        #[arg(long)]
        session_id: String,
        #[arg(long)]
        state: String,
    },
    /// Remove an agent session
    Remove {
        #[arg(long)]
        session_id: String,
    },
    /// Check if the app is running
    Health,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisterBody {
    agent: String,
    session_id: String,
    on_click: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateBody {
    session_id: String,
    state: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoveBody {
    session_id: String,
}

fn get_base_url() -> String {
    let port_file = dirs::home_dir()
        .expect("cannot find home directory")
        .join(".agentmonitor.port");

    let port = fs::read_to_string(&port_file).unwrap_or_else(|_| {
        eprintln!("Agent Monitor is not running (no port file found)");
        process::exit(1);
    });

    let port = port.trim();
    format!("http://127.0.0.1:{port}")
}

fn main() {
    let cli = Cli::parse();
    let base_url = get_base_url();

    let result = match cli.command {
        Commands::Register {
            agent,
            session_id,
            on_click,
        } => {
            let body = RegisterBody {
                agent,
                session_id,
                on_click,
            };
            ureq::post(format!("{base_url}/register"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Update { session_id, state } => {
            let body = UpdateBody { session_id, state };
            ureq::post(format!("{base_url}/update"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Remove { session_id } => {
            let body = RemoveBody { session_id };
            ureq::post(format!("{base_url}/remove"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Health => ureq::get(format!("{base_url}/health"))
            .call()
            .map(|_| ()),
    };

    match result {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Error: {e}");
            process::exit(1);
        }
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd cli && cargo check`

Expected: No errors.

- [ ] **Step 3: Build the CLI binary**

Run: `cd cli && cargo build --release`

Expected: Binary at `cli/target/release/agentmonitor`.

- [ ] **Step 4: Commit**

```bash
git add cli/src/main.rs
git commit -m "feat: implement agentmonitor CLI with register/update/remove/health commands"
```

---

### Task 5: Tauri Commands (Click Action + Config)

**Files:**
- Create: `src-tauri/src/commands.rs`
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement the config module**

Create `src-tauri/src/config.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub orientation: String,
    pub always_on_top: bool,
    pub mascot_size: String,
    pub show_labels: bool,
    pub show_tooltips: bool,
    pub position: Position,
    pub sound: SoundConfig,
    pub theme: ThemeConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub background_color: String,
    pub background_opacity: f64,
    pub blur_radius: u32,
    pub border_radius: u32,
    pub border_color: String,
    pub accent_color: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            orientation: "horizontal".into(),
            always_on_top: true,
            mascot_size: "medium".into(),
            show_labels: true,
            show_tooltips: true,
            position: Position { x: 100.0, y: 100.0 },
            sound: SoundConfig {
                enabled: true,
                volume: 0.5,
            },
            theme: ThemeConfig {
                background_color: "#1a1a2e".into(),
                background_opacity: 0.8,
                blur_radius: 20,
                border_radius: 12,
                border_color: "#ffffff10".into(),
                accent_color: "#E8825A".into(),
            },
        }
    }
}

fn config_path() -> PathBuf {
    dirs::home_dir()
        .expect("cannot find home directory")
        .join(".agentmonitor")
        .join("config.json")
}

pub fn load_config() -> Config {
    let path = config_path();
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Config::default()
    }
}

pub fn save_config(config: &Config) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let data = serde_json::to_string_pretty(config).unwrap();
    let _ = fs::write(path, data);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_serializes() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.orientation, "horizontal");
        assert_eq!(parsed.theme.blur_radius, 20);
        assert!(parsed.sound.enabled);
    }
}
```

- [ ] **Step 2: Implement Tauri commands**

Create `src-tauri/src/commands.rs`:

```rust
use crate::config::{self, Config};
use crate::state::SessionStore;
use std::process::Command;
use std::sync::Arc;
use tauri::State;

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
```

- [ ] **Step 3: Register commands in Tauri builder**

Update `src-tauri/src/lib.rs`:

```rust
mod commands;
mod config;
mod server;
mod state;

use state::SessionStore;
use std::sync::Arc;

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
```

- [ ] **Step 4: Run tests and verify compilation**

Run: `cd src-tauri && cargo test`

Expected: All tests pass, no compilation errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/config.rs src-tauri/src/lib.rs
git commit -m "feat: add Tauri commands for click action, config, and session listing"
```

---

### Task 6: Mascot System (Frontend)

**Files:**
- Create: `src/mascots/types.ts`
- Create: `src/mascots/claude-code.ts`
- Create: `src/mascots/registry.ts`

- [ ] **Step 1: Define the MascotDefinition interface**

Create `src/mascots/types.ts`:

```typescript
export type MascotState =
  | "idle"
  | "thinking"
  | "needs-input"
  | "error"
  | "compacting"
  | "notification"
  | "entering"
  | "exiting";

export interface MascotDefinition {
  svg(state: MascotState): string;
  css: string;
  metadata: {
    name: string;
    defaultColor: string;
    size: { width: number; height: number };
  };
}
```

- [ ] **Step 2: Create the Claude Code mascot**

Create `src/mascots/claude-code.ts`:

```typescript
import { MascotDefinition, MascotState } from "./types";

function face(eyes: string, mouth: string, extras: string = ""): string {
  return `<svg viewBox="0 0 48 56" class="mascot-svg">
    <!-- Body -->
    <ellipse cx="24" cy="22" rx="16" ry="15" fill="#E8825A" class="mascot-body"/>
    <!-- Eyes -->
    ${eyes}
    <!-- Mouth -->
    ${mouth}
    <!-- Legs -->
    <rect x="16" y="37" width="5" height="9" rx="2.5" fill="#D4744E" class="mascot-leg-left"/>
    <rect x="27" y="37" width="5" height="9" rx="2.5" fill="#D4744E" class="mascot-leg-right"/>
    <!-- Extras -->
    ${extras}
  </svg>`;
}

const EYES = {
  normal: `<circle cx="18" cy="19" r="2.5" fill="#2a1a0e"/>
           <circle cx="30" cy="19" r="2.5" fill="#2a1a0e"/>`,
  wide: `<circle cx="18" cy="19" r="3.5" fill="#2a1a0e"/>
         <circle cx="30" cy="19" r="3.5" fill="#2a1a0e"/>
         <circle cx="19" cy="18" r="1.2" fill="white"/>
         <circle cx="31" cy="18" r="1.2" fill="white"/>`,
  closed: `<line x1="15" y1="19" x2="21" y2="19" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
           <line x1="27" y1="19" x2="33" y2="19" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>`,
  x: `<line x1="15" y1="16" x2="21" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="16" x2="15" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
      <line x1="27" y1="16" x2="33" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>
      <line x1="33" y1="16" x2="27" y2="22" stroke="#2a1a0e" stroke-width="2" stroke-linecap="round"/>`,
  squint: `<path d="M15 18 Q18 21 21 18" stroke="#2a1a0e" stroke-width="2" fill="none" stroke-linecap="round"/>
           <path d="M27 18 Q30 21 33 18" stroke="#2a1a0e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
};

const MOUTHS = {
  smile: `<path d="M20 26 Q24 30 28 26" stroke="#2a1a0e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  open: `<ellipse cx="24" cy="27" rx="3.5" ry="2.5" fill="#2a1a0e"/>`,
  flat: `<line x1="20" y1="27" x2="28" y2="27" stroke="#2a1a0e" stroke-width="1.5" stroke-linecap="round"/>`,
  frown: `<path d="M20 28 Q24 24 28 28" stroke="#2a1a0e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  small: `<circle cx="24" cy="27" r="1.5" fill="#2a1a0e"/>`,
};

const EXTRAS = {
  thinkingDots: `<circle cx="38" cy="8" r="2" fill="#ffd700" class="think-dot-1"/>
                 <circle cx="43" cy="5" r="2.5" fill="#ffd700" class="think-dot-2"/>
                 <circle cx="48" cy="2" r="3" fill="#ffd700" class="think-dot-3"/>`,
  questionMark: `<text x="38" y="10" font-size="14" fill="#e0b956" class="question-mark">?</text>`,
  sweatDrops: `<ellipse cx="40" cy="14" rx="1.5" ry="3" fill="#87CEEB" class="sweat-1"/>
               <ellipse cx="8" cy="18" rx="1.2" ry="2.5" fill="#87CEEB" class="sweat-2"/>`,
  bellIcon: `<text x="36" y="12" font-size="12" class="bell-icon">🔔</text>`,
  waveArm: `<rect x="38" y="18" width="4" height="10" rx="2" fill="#D4744E" class="wave-arm"/>`,
};

const states: Record<MascotState, string> = {
  idle: face(EYES.normal, MOUTHS.smile),
  thinking: face(EYES.closed, MOUTHS.small, EXTRAS.thinkingDots),
  "needs-input": face(EYES.wide, MOUTHS.open, EXTRAS.questionMark),
  error: face(EYES.x, MOUTHS.frown),
  compacting: face(EYES.squint, MOUTHS.flat, EXTRAS.sweatDrops),
  notification: face(EYES.normal, MOUTHS.open, EXTRAS.bellIcon + EXTRAS.waveArm),
  entering: face(EYES.wide, MOUTHS.open),
  exiting: face(EYES.closed, MOUTHS.smile),
};

export const claudeCode: MascotDefinition = {
  svg(state: MascotState): string {
    return states[state] ?? states.idle;
  },

  css: `
    /* Idle: gentle breathing */
    .state-idle .mascot-body {
      animation: breathe 3s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(1.03); }
    }

    /* Thinking: head wobble + dot pulse */
    .state-thinking .mascot-svg {
      animation: wobble 1.5s ease-in-out infinite;
    }
    @keyframes wobble {
      0%, 100% { transform: rotate(-2deg); }
      50% { transform: rotate(2deg); }
    }
    .think-dot-1 { animation: dotPulse 1s 0s infinite; }
    .think-dot-2 { animation: dotPulse 1s 0.3s infinite; }
    .think-dot-3 { animation: dotPulse 1s 0.6s infinite; }
    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

    /* Needs input: bounce + question pulse */
    .state-needs-input .mascot-svg {
      animation: bounce 0.6s ease-in-out infinite alternate;
    }
    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-6px); }
    }
    .question-mark {
      animation: pulse 0.8s ease-in-out infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.5; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1.15); }
    }

    /* Error: shake + red tint */
    .state-error .mascot-svg {
      animation: shake 0.3s ease-in-out infinite;
    }
    .state-error .mascot-body {
      fill: #cc4444;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }

    /* Compacting: squeeze + sweat */
    .state-compacting .mascot-svg {
      animation: squeeze 1s ease-in-out infinite;
    }
    @keyframes squeeze {
      0%, 100% { transform: scaleX(1) scaleY(1); }
      50% { transform: scaleX(1.1) scaleY(0.85); }
    }
    .sweat-1 { animation: drip 1.2s 0s ease-in infinite; }
    .sweat-2 { animation: drip 1.2s 0.4s ease-in infinite; }
    @keyframes drip {
      0% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(8px); }
    }

    /* Notification: wave arm + bell */
    .wave-arm {
      transform-origin: 38px 18px;
      animation: wave 0.5s ease-in-out infinite alternate;
    }
    @keyframes wave {
      from { transform: rotate(-15deg); }
      to { transform: rotate(15deg); }
    }
    .bell-icon {
      animation: ring 0.4s ease-in-out infinite alternate;
    }
    @keyframes ring {
      from { transform: rotate(-10deg); }
      to { transform: rotate(10deg); }
    }

    /* Entering: drop from above */
    .state-entering .mascot-wrapper {
      animation: enterDrop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes enterDrop {
      from { transform: translateY(-60px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Exiting: slide down and fade */
    .state-exiting .mascot-wrapper {
      animation: exitSlide 0.4s ease-in forwards;
    }
    @keyframes exitSlide {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(40px); opacity: 0; }
    }
  `,

  metadata: {
    name: "Claude Code",
    defaultColor: "#E8825A",
    size: { width: 48, height: 56 },
  },
};
```

- [ ] **Step 3: Create the mascot registry**

Create `src/mascots/registry.ts`:

```typescript
import { MascotDefinition } from "./types";
import { claudeCode } from "./claude-code";

const mascots: Record<string, MascotDefinition> = {
  "claude-code": claudeCode,
};

export function getMascot(agent: string): MascotDefinition {
  return mascots[agent] ?? mascots["claude-code"];
}

export function getAllMascotCSS(): string {
  return Object.values(mascots)
    .map((m) => m.css)
    .join("\n");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/mascots/
git commit -m "feat: add mascot system with Claude Code SVG animations for all states"
```

---

### Task 7: Frontend State & Mascot Grid

**Files:**
- Create: `src/state.ts`
- Create: `src/mascot-grid.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create the frontend session state store**

Create `src/state.ts`:

```typescript
export interface Session {
  sessionId: string;
  agent: string;
  state: string;
  onClick: string;
  registeredAt: number;
}

type Listener = (sessions: Session[]) => void;

class SessionState {
  private sessions: Map<string, Session> = new Map();
  private listeners: Listener[] = [];

  add(session: Session): void {
    this.sessions.set(session.sessionId, session);
    this.notify();
  }

  update(session: Session): void {
    const existing = this.sessions.get(session.sessionId);
    if (existing) {
      existing.state = session.state;
      this.notify();
    }
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.notify();
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const all = this.getAll();
    this.listeners.forEach((l) => l(all));
  }
}

export const sessionState = new SessionState();
```

- [ ] **Step 2: Create the mascot grid component**

Create `src/mascot-grid.ts`:

```typescript
import { Session, sessionState } from "./state";
import { getMascot, getAllMascotCSS } from "./mascots/registry";
import { MascotState } from "./mascots/types";
import { invoke } from "@tauri-apps/api/core";

export function initMascotGrid(container: HTMLElement): void {
  // Inject mascot CSS
  const style = document.createElement("style");
  style.textContent = getAllMascotCSS();
  document.head.appendChild(style);

  const grid = document.createElement("div");
  grid.className = "mascot-grid";
  container.appendChild(grid);

  sessionState.subscribe((sessions) => render(grid, sessions));
}

function render(grid: HTMLElement, sessions: Session[]): void {
  const existingIds = new Set(
    Array.from(grid.children).map((el) => (el as HTMLElement).dataset.sessionId)
  );
  const currentIds = new Set(sessions.map((s) => s.sessionId));

  // Remove departed sessions
  Array.from(grid.children).forEach((el) => {
    const id = (el as HTMLElement).dataset.sessionId;
    if (id && !currentIds.has(id)) {
      el.remove();
    }
  });

  // Add or update sessions
  sessions.forEach((session) => {
    let el = grid.querySelector(
      `[data-session-id="${session.sessionId}"]`
    ) as HTMLElement | null;

    if (!el) {
      el = createMascotElement(session);
      grid.appendChild(el);
    } else {
      updateMascotElement(el, session);
    }
  });
}

function createMascotElement(session: Session): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = `mascot-item state-entering`;
  wrapper.dataset.sessionId = session.sessionId;

  const mascotWrapper = document.createElement("div");
  mascotWrapper.className = "mascot-wrapper";

  const mascot = getMascot(session.agent);
  mascotWrapper.innerHTML = mascot.svg("entering" as MascotState);

  wrapper.appendChild(mascotWrapper);
  wrapper.addEventListener("click", () => {
    invoke("execute_click", { sessionId: session.sessionId });
  });

  // Transition to actual state after entrance animation
  setTimeout(() => {
    updateMascotElement(wrapper, session);
  }, 450);

  return wrapper;
}

function updateMascotElement(el: HTMLElement, session: Session): void {
  const state = session.state as MascotState;
  const mascot = getMascot(session.agent);

  // Remove all state classes, add current
  el.className = `mascot-item state-${state}`;
  el.dataset.sessionId = session.sessionId;

  const wrapper = el.querySelector(".mascot-wrapper");
  if (wrapper) {
    wrapper.innerHTML = mascot.svg(state);
  }
}

export function triggerExit(
  container: HTMLElement,
  sessionId: string
): Promise<void> {
  return new Promise((resolve) => {
    const el = container.querySelector(
      `[data-session-id="${sessionId}"]`
    ) as HTMLElement | null;

    if (el) {
      el.className = "mascot-item state-exiting";
      const mascot = getMascot("claude-code");
      const wrapper = el.querySelector(".mascot-wrapper");
      if (wrapper) {
        wrapper.innerHTML = mascot.svg("exiting");
      }
      setTimeout(() => {
        el.remove();
        resolve();
      }, 400);
    } else {
      resolve();
    }
  });
}
```

- [ ] **Step 3: Wire up the main entry point with Tauri event listeners**

Replace `src/main.ts`:

```typescript
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Session, sessionState } from "./state";
import { initMascotGrid, triggerExit } from "./mascot-grid";

async function init(): Promise<void> {
  const app = document.getElementById("app")!;
  initMascotGrid(app);

  // Load existing sessions (in case frontend reloads)
  const existing = await invoke<Session[]>("get_sessions");
  existing.forEach((s) => sessionState.add(s));

  // Listen for backend events
  await listen<Session>("session-added", (event) => {
    sessionState.add(event.payload);
  });

  await listen<Session>("session-updated", (event) => {
    sessionState.update(event.payload);
  });

  await listen<Session>("session-removed", (event) => {
    const grid = document.querySelector(".mascot-grid") as HTMLElement;
    if (grid) {
      triggerExit(grid, event.payload.sessionId).then(() => {
        sessionState.remove(event.payload.sessionId);
      });
    }
  });
}

init();
```

- [ ] **Step 4: Add grid and mascot styles**

Append to `src/styles.css`:

```css
.mascot-grid {
  display: flex;
  gap: 8px;
  padding: 8px;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}

.mascot-grid.vertical {
  flex-direction: column;
}

.mascot-item {
  cursor: pointer;
  transition: transform 0.15s ease;
  position: relative;
}

.mascot-item:hover {
  transform: scale(1.1);
}

.mascot-item:active {
  transform: scale(0.95);
}

.mascot-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.mascot-svg {
  width: var(--mascot-size, 48px);
  height: var(--mascot-size, 48px);
  overflow: visible;
}

.mascot-label {
  font-size: 9px;
  color: #aaa;
  text-align: center;
  margin-top: 2px;
  white-space: nowrap;
}

/* Size variants */
.size-small .mascot-svg { --mascot-size: 32px; }
.size-medium .mascot-svg { --mascot-size: 48px; }
.size-large .mascot-svg { --mascot-size: 64px; }
```

- [ ] **Step 5: Commit**

```bash
git add src/state.ts src/mascot-grid.ts src/main.ts src/styles.css
git commit -m "feat: add frontend state management and mascot grid rendering"
```

---

### Task 8: Window Setup (Frameless, Vibrancy, Drag, Auto-Resize)

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/main.ts`

- [ ] **Step 1: Apply macOS vibrancy on window creation**

In `src-tauri/src/lib.rs`, update the `setup` closure to apply vibrancy and load saved position:

```rust
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
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Failed to apply vibrancy");

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
```

- [ ] **Step 2: Add auto-resize logic to the frontend**

Add to `src/main.ts` after the event listeners:

```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

// ... existing init code, then add:

async function resizeWindow(): Promise<void> {
  const config = await invoke<any>("get_config");
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;

  const count = grid.children.length;
  if (count === 0) return;

  const sizeMap: Record<string, number> = {
    small: 32,
    medium: 48,
    large: 64,
  };
  const mascotSize = sizeMap[config.mascotSize] ?? 48;
  const gap = 8;
  const padding = 16;

  const appWindow = getCurrentWindow();

  if (config.orientation === "horizontal") {
    const width = count * mascotSize + (count - 1) * gap + padding * 2;
    const height = mascotSize + padding * 2;
    await appWindow.setSize(new (await import("@tauri-apps/api/dpi")).LogicalSize(width, height));
  } else {
    const width = mascotSize + padding * 2;
    const height = count * mascotSize + (count - 1) * gap + padding * 2;
    await appWindow.setSize(new (await import("@tauri-apps/api/dpi")).LogicalSize(width, height));
  }
}
```

Call `resizeWindow()` inside the `sessionState.subscribe` callback and after loading existing sessions in `init()`.

- [ ] **Step 3: Save window position on move**

Add to `src/main.ts`:

```typescript
import { listen as listenWindow } from "@tauri-apps/api/event";

// Inside init():
await listenWindow("tauri://move", async () => {
  const appWindow = getCurrentWindow();
  const pos = await appWindow.outerPosition();
  const config = await invoke<any>("get_config");
  config.position = { x: pos.x, y: pos.y };
  await invoke("save_config", { config });
});
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src/main.ts
git commit -m "feat: add vibrancy, auto-resize, and position persistence"
```

---

### Task 9: Sound System

**Files:**
- Create: `src/sound.ts`
- Modify: `src/mascot-grid.ts`

- [ ] **Step 1: Create the sound manager**

Create `src/sound.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

const SOUND_MAP: Record<string, string> = {
  entering: "enter.wav",
  exiting: "exit.wav",
  thinking: "tick.wav",
  "needs-input": "ping.wav",
  error: "buzz.wav",
  compacting: "squeeze.wav",
  notification: "bell.wav",
};

let audioCache: Map<string, HTMLAudioElement> = new Map();
let enabled = true;
let volume = 0.5;

export async function initSound(): Promise<void> {
  const config = await invoke<any>("get_config");
  enabled = config.sound?.enabled ?? true;
  volume = config.sound?.volume ?? 0.5;
}

export function updateSoundSettings(soundEnabled: boolean, soundVolume: number): void {
  enabled = soundEnabled;
  volume = soundVolume;
}

export function playStateSound(state: string): void {
  if (!enabled) return;

  const file = SOUND_MAP[state];
  if (!file) return;

  let audio = audioCache.get(file);
  if (!audio) {
    audio = new Audio(`/sounds/${file}`);
    audioCache.set(file, audio);
  }

  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Audio play can fail if no user interaction yet; ignore
  });
}
```

- [ ] **Step 2: Integrate sound into mascot state transitions**

In `src/mascot-grid.ts`, import and call `playStateSound`:

Add at the top:
```typescript
import { playStateSound } from "./sound";
```

In `createMascotElement`, after creating the wrapper:
```typescript
playStateSound("entering");
```

In `updateMascotElement`, when the state changes:
```typescript
playStateSound(state);
```

In `triggerExit`, when starting the exit:
```typescript
playStateSound("exiting");
```

- [ ] **Step 3: Add sounds directory placeholder**

Create `sounds/.gitkeep` (actual .wav files will be generated or sourced separately — for now the system is wired up and will silently fail to load missing files):

```bash
mkdir -p sounds
touch sounds/.gitkeep
```

- [ ] **Step 4: Update vite config to serve sounds in dev**

In `vite.config.ts`, add the public dir:

```typescript
export default defineConfig({
  publicDir: "sounds",
  // ... rest of config
});
```

Actually, Vite serves `public/` by default. Move sounds into `public/sounds/`:

```bash
mkdir -p public/sounds
mv sounds/.gitkeep public/sounds/.gitkeep
rmdir sounds
```

Update `src-tauri/tauri.conf.json` resource path:
```json
"resources": ["../public/sounds/*"]
```

- [ ] **Step 5: Initialize sound in main.ts**

Add to `src/main.ts`:

```typescript
import { initSound } from "./sound";

// Inside init(), before event listeners:
await initSound();
```

- [ ] **Step 6: Commit**

```bash
git add src/sound.ts src/mascot-grid.ts src/main.ts public/sounds/.gitkeep vite.config.ts src-tauri/tauri.conf.json
git commit -m "feat: add sound system with per-state audio playback"
```

---

### Task 10: Tooltip Component

**Files:**
- Create: `src/tooltip.ts`
- Modify: `src/mascot-grid.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create the tooltip component**

Create `src/tooltip.ts`:

```typescript
import { Session } from "./state";

let tooltipEl: HTMLElement | null = null;

export function initTooltip(): void {
  tooltipEl = document.createElement("div");
  tooltipEl.className = "tooltip";
  tooltipEl.style.display = "none";
  document.body.appendChild(tooltipEl);
}

export function showTooltip(session: Session, anchor: HTMLElement): void {
  if (!tooltipEl) return;

  const uptime = Math.floor((Date.now() / 1000 - session.registeredAt) / 60);
  const uptimeText = uptime < 1 ? "<1m" : `${uptime}m`;

  tooltipEl.innerHTML = `
    <div class="tooltip-row"><span class="tooltip-label">Session</span> ${session.sessionId.slice(0, 8)}...</div>
    <div class="tooltip-row"><span class="tooltip-label">Agent</span> ${session.agent}</div>
    <div class="tooltip-row"><span class="tooltip-label">State</span> ${session.state}</div>
    <div class="tooltip-row"><span class="tooltip-label">Uptime</span> ${uptimeText}</div>
  `;

  const rect = anchor.getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
  tooltipEl.style.top = `${rect.top - 8}px`;
  tooltipEl.style.display = "block";
}

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.style.display = "none";
  }
}
```

- [ ] **Step 2: Add tooltip hover events to mascot items**

In `src/mascot-grid.ts`, in `createMascotElement`, add hover listeners:

```typescript
import { showTooltip, hideTooltip } from "./tooltip";

// Inside createMascotElement, after the click listener:
wrapper.addEventListener("mouseenter", () => {
  const currentSession = sessionState.get(session.sessionId);
  if (currentSession) {
    showTooltip(currentSession, wrapper);
  }
});
wrapper.addEventListener("mouseleave", () => {
  hideTooltip();
});
```

- [ ] **Step 3: Add tooltip styles**

Append to `src/styles.css`:

```css
.tooltip {
  position: fixed;
  transform: translateX(-50%) translateY(-100%);
  background: rgba(20, 20, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
  color: #ddd;
  pointer-events: none;
  z-index: 1000;
  backdrop-filter: blur(10px);
  white-space: nowrap;
}

.tooltip-row {
  display: flex;
  gap: 8px;
  line-height: 1.6;
}

.tooltip-label {
  color: #888;
  font-weight: 500;
  min-width: 50px;
}
```

- [ ] **Step 4: Initialize tooltip in main.ts**

Add to `src/main.ts`:

```typescript
import { initTooltip } from "./tooltip";

// Inside init(), after initMascotGrid:
initTooltip();
```

- [ ] **Step 5: Commit**

```bash
git add src/tooltip.ts src/mascot-grid.ts src/styles.css src/main.ts
git commit -m "feat: add hover tooltip showing session details"
```

---

### Task 11: Preferences Popover

**Files:**
- Create: `src/preferences.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create the preferences popover component**

Create `src/preferences.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { updateSoundSettings } from "./sound";

interface Config {
  orientation: string;
  alwaysOnTop: boolean;
  mascotSize: string;
  showLabels: boolean;
  showTooltips: boolean;
  position: { x: number; y: number };
  sound: { enabled: boolean; volume: number };
  theme: {
    backgroundColor: string;
    backgroundOpacity: number;
    blurRadius: number;
    borderRadius: number;
    borderColor: string;
    accentColor: string;
  };
}

let prefsEl: HTMLElement | null = null;
let currentConfig: Config | null = null;
let onConfigChange: ((config: Config) => void) | null = null;

export function initPreferences(onChange: (config: Config) => void): void {
  onConfigChange = onChange;

  document.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    await togglePreferences();
  });
}

async function togglePreferences(): Promise<void> {
  if (prefsEl) {
    closePreferences();
    return;
  }

  currentConfig = await invoke<Config>("get_config");
  prefsEl = document.createElement("div");
  prefsEl.className = "preferences-popover";
  prefsEl.innerHTML = buildPrefsHTML(currentConfig);
  document.body.appendChild(prefsEl);

  // Stop drag on preferences
  prefsEl.addEventListener("mousedown", (e) => e.stopPropagation());

  bindPrefsEvents(prefsEl, currentConfig);
}

function closePreferences(): void {
  prefsEl?.remove();
  prefsEl = null;
}

function buildPrefsHTML(config: Config): string {
  return `
    <div class="prefs-header">
      <span>Preferences</span>
      <button class="prefs-close" id="prefs-close">&times;</button>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Layout</div>

      <div class="prefs-row">
        <label>Orientation</label>
        <select id="pref-orientation">
          <option value="horizontal" ${config.orientation === "horizontal" ? "selected" : ""}>Horizontal</option>
          <option value="vertical" ${config.orientation === "vertical" ? "selected" : ""}>Vertical</option>
        </select>
      </div>

      <div class="prefs-row">
        <label>Mascot Size</label>
        <select id="pref-mascot-size">
          <option value="small" ${config.mascotSize === "small" ? "selected" : ""}>Small</option>
          <option value="medium" ${config.mascotSize === "medium" ? "selected" : ""}>Medium</option>
          <option value="large" ${config.mascotSize === "large" ? "selected" : ""}>Large</option>
        </select>
      </div>

      <div class="prefs-row">
        <label>Show Labels</label>
        <input type="checkbox" id="pref-show-labels" ${config.showLabels ? "checked" : ""}>
      </div>

      <div class="prefs-row">
        <label>Show Tooltips</label>
        <input type="checkbox" id="pref-show-tooltips" ${config.showTooltips ? "checked" : ""}>
      </div>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Appearance</div>

      <div class="prefs-row">
        <label>Background</label>
        <input type="color" id="pref-bg-color" value="${config.theme.backgroundColor}">
      </div>

      <div class="prefs-row">
        <label>Opacity</label>
        <input type="range" id="pref-bg-opacity" min="0" max="100" value="${Math.round(config.theme.backgroundOpacity * 100)}">
      </div>

      <div class="prefs-row">
        <label>Blur</label>
        <input type="range" id="pref-blur" min="0" max="50" value="${config.theme.blurRadius}">
      </div>

      <div class="prefs-row">
        <label>Corner Radius</label>
        <input type="range" id="pref-border-radius" min="0" max="30" value="${config.theme.borderRadius}">
      </div>

      <div class="prefs-row">
        <label>Border Color</label>
        <input type="color" id="pref-border-color" value="${config.theme.borderColor.slice(0, 7)}">
      </div>

      <div class="prefs-row">
        <label>Accent</label>
        <input type="color" id="pref-accent-color" value="${config.theme.accentColor}">
      </div>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Sound</div>

      <div class="prefs-row">
        <label>Enabled</label>
        <input type="checkbox" id="pref-sound-enabled" ${config.sound.enabled ? "checked" : ""}>
      </div>

      <div class="prefs-row">
        <label>Volume</label>
        <input type="range" id="pref-sound-volume" min="0" max="100" value="${Math.round(config.sound.volume * 100)}">
      </div>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Behavior</div>

      <div class="prefs-row">
        <label>Always on Top</label>
        <input type="checkbox" id="pref-always-on-top" ${config.alwaysOnTop ? "checked" : ""}>
      </div>
    </div>
  `;
}

function bindPrefsEvents(el: HTMLElement, config: Config): void {
  const save = async () => {
    await invoke("save_config", { config });
    if (onConfigChange) onConfigChange(config);
  };

  el.querySelector("#prefs-close")?.addEventListener("click", closePreferences);

  bindSelect(el, "#pref-orientation", (v) => { config.orientation = v; save(); });
  bindSelect(el, "#pref-mascot-size", (v) => { config.mascotSize = v; save(); });
  bindCheckbox(el, "#pref-show-labels", (v) => { config.showLabels = v; save(); });
  bindCheckbox(el, "#pref-show-tooltips", (v) => { config.showTooltips = v; save(); });
  bindColor(el, "#pref-bg-color", (v) => { config.theme.backgroundColor = v; save(); });
  bindRange(el, "#pref-bg-opacity", (v) => { config.theme.backgroundOpacity = v / 100; save(); });
  bindRange(el, "#pref-blur", (v) => { config.theme.blurRadius = v; save(); });
  bindRange(el, "#pref-border-radius", (v) => { config.theme.borderRadius = v; save(); });
  bindColor(el, "#pref-border-color", (v) => { config.theme.borderColor = v; save(); });
  bindColor(el, "#pref-accent-color", (v) => { config.theme.accentColor = v; save(); });
  bindCheckbox(el, "#pref-sound-enabled", (v) => {
    config.sound.enabled = v;
    updateSoundSettings(config.sound.enabled, config.sound.volume);
    save();
  });
  bindRange(el, "#pref-sound-volume", (v) => {
    config.sound.volume = v / 100;
    updateSoundSettings(config.sound.enabled, config.sound.volume);
    save();
  });
  bindCheckbox(el, "#pref-always-on-top", async (v) => {
    config.alwaysOnTop = v;
    const appWindow = getCurrentWindow();
    await appWindow.setAlwaysOnTop(v);
    save();
  });
}

function bindSelect(el: HTMLElement, selector: string, cb: (v: string) => void): void {
  el.querySelector(selector)?.addEventListener("change", (e) => cb((e.target as HTMLSelectElement).value));
}

function bindCheckbox(el: HTMLElement, selector: string, cb: (v: boolean) => void): void {
  el.querySelector(selector)?.addEventListener("change", (e) => cb((e.target as HTMLInputElement).checked));
}

function bindColor(el: HTMLElement, selector: string, cb: (v: string) => void): void {
  el.querySelector(selector)?.addEventListener("input", (e) => cb((e.target as HTMLInputElement).value));
}

function bindRange(el: HTMLElement, selector: string, cb: (v: number) => void): void {
  el.querySelector(selector)?.addEventListener("input", (e) => cb(Number((e.target as HTMLInputElement).value)));
}
```

- [ ] **Step 2: Add preferences styles**

Append to `src/styles.css`:

```css
.preferences-popover {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(20, 20, 40, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  z-index: 2000;
  color: #ddd;
  font-size: 12px;
  min-width: 260px;
  max-height: 90vh;
  overflow-y: auto;
}

.prefs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
}

.prefs-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.prefs-close:hover {
  color: #fff;
}

.prefs-section {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.prefs-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.prefs-section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 8px;
}

.prefs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.prefs-row label {
  color: #aaa;
}

.prefs-row select,
.prefs-row input[type="range"] {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #ddd;
  padding: 2px 6px;
  font-size: 11px;
}

.prefs-row input[type="color"] {
  width: 28px;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
}

.prefs-row input[type="range"] {
  width: 100px;
}

.prefs-row input[type="checkbox"] {
  accent-color: #E8825A;
}
```

- [ ] **Step 3: Add config change handler to apply theme live**

In `src/main.ts`, add the config change handler and wire up preferences:

```typescript
import { initPreferences } from "./preferences";

// Inside init():
initPreferences(applyConfig);

// Load and apply initial config
const config = await invoke<any>("get_config");
applyConfig(config);

// Config change handler:
function applyConfig(config: any): void {
  const app = document.getElementById("app")!;
  const grid = app.querySelector(".mascot-grid") as HTMLElement;

  // Apply orientation
  if (grid) {
    grid.classList.toggle("vertical", config.orientation === "vertical");
  }

  // Apply theme as CSS custom properties
  const root = document.documentElement;
  root.style.setProperty("--bg-color", config.theme.backgroundColor);
  root.style.setProperty("--bg-opacity", config.theme.backgroundOpacity);
  root.style.setProperty("--blur-radius", `${config.theme.blurRadius}px`);
  root.style.setProperty("--border-radius", `${config.theme.borderRadius}px`);
  root.style.setProperty("--border-color", config.theme.borderColor);
  root.style.setProperty("--accent-color", config.theme.accentColor);

  // Apply size class
  app.className = `size-${config.mascotSize}`;
}
```

- [ ] **Step 4: Add CSS custom property usage to the app container**

Update the `#app` style in `src/styles.css`:

```css
#app {
  width: 100vw;
  height: 100vh;
  background: color-mix(in srgb, var(--bg-color, #1a1a2e) calc(var(--bg-opacity, 0.8) * 100%), transparent);
  border-radius: var(--border-radius, 12px);
  border: 1px solid var(--border-color, #ffffff10);
  backdrop-filter: blur(var(--blur-radius, 20px));
}
```

- [ ] **Step 5: Commit**

```bash
git add src/preferences.ts src/main.ts src/styles.css
git commit -m "feat: add preferences popover with live theme, layout, sound, and behavior settings"
```

---

### Task 12: Labels Support

**Files:**
- Modify: `src/mascot-grid.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add label rendering to mascot items**

In `src/mascot-grid.ts`, update `createMascotElement` to add a label element:

After `mascotWrapper`, add:

```typescript
const label = document.createElement("div");
label.className = "mascot-label";
label.textContent = session.state;
wrapper.appendChild(label);
```

In `updateMascotElement`, update the label text:

```typescript
const label = el.querySelector(".mascot-label") as HTMLElement;
if (label) {
  label.textContent = state;
}
```

- [ ] **Step 2: Toggle label visibility from config**

In `src/main.ts`, inside `applyConfig`:

```typescript
document.querySelectorAll(".mascot-label").forEach((el) => {
  (el as HTMLElement).style.display = config.showLabels ? "block" : "none";
});
```

- [ ] **Step 3: Commit**

```bash
git add src/mascot-grid.ts src/main.ts
git commit -m "feat: add toggleable status labels below mascots"
```

---

### Task 13: Integration Test — End-to-End Wiring

**Files:**
- Modify: `src/main.ts` (final assembly)

- [ ] **Step 1: Verify the full flow compiles and builds**

Run:
```bash
npm install
cd cli && cargo build --release && cd ..
cd src-tauri && cargo build && cd ..
```

Expected: All three compile without errors.

- [ ] **Step 2: Run all Rust tests**

Run:
```bash
cargo test --workspace
```

Expected: All tests pass.

- [ ] **Step 3: Test manually with the CLI**

Start the app:
```bash
npm run tauri dev
```

In another terminal, test the CLI:
```bash
# Build CLI
cd cli && cargo build --release && cd ..

# Register a session
./cli/target/release/agentmonitor register --agent claude-code --session-id test-1 --on-click "echo clicked"

# Update state
./cli/target/release/agentmonitor update --session-id test-1 --state thinking

# Update to needs-input
./cli/target/release/agentmonitor update --session-id test-1 --state needs-input

# Remove
./cli/target/release/agentmonitor remove --session-id test-1
```

Expected: Mascot appears with entrance animation, transitions between states with correct animations, exits with slide-down animation. Right-click opens preferences.

- [ ] **Step 4: Commit final integration**

```bash
git add -A
git commit -m "feat: complete agent monitor v1 — end-to-end integration"
```

---

### Task 14: Sound Asset Generation

**Files:**
- Create: `public/sounds/enter.wav`
- Create: `public/sounds/exit.wav`
- Create: `public/sounds/tick.wav`
- Create: `public/sounds/ping.wav`
- Create: `public/sounds/buzz.wav`
- Create: `public/sounds/squeeze.wav`
- Create: `public/sounds/bell.wav`

- [ ] **Step 1: Generate sound files using `sox` or `ffmpeg`**

These are short synthesized sounds. Generate them with `sox` (install via `brew install sox`):

```bash
cd public/sounds

# enter.wav - soft rising chime (200ms)
sox -n enter.wav synth 0.2 sine 800:1200 fade h 0.02 0.2 0.05 vol 0.5

# exit.wav - gentle falling swoosh (200ms)
sox -n exit.wav synth 0.2 sine 600:300 fade h 0.02 0.2 0.08 vol 0.4

# tick.wav - subtle click (100ms)
sox -n tick.wav synth 0.1 sine 1000 fade h 0.01 0.1 0.05 vol 0.3

# ping.wav - attention ping (300ms)
sox -n ping.wav synth 0.3 sine 1200 fade h 0.01 0.3 0.1 vol 0.6

# buzz.wav - low error buzz (200ms)
sox -n buzz.wav synth 0.2 square 200 fade h 0.01 0.2 0.05 vol 0.3

# squeeze.wav - compress sound (250ms)
sox -n squeeze.wav synth 0.25 sine 500:300 bend 0.1,300,0.15 fade h 0.02 0.25 0.08 vol 0.4

# bell.wav - notification bell (400ms)
sox -n bell.wav synth 0.4 sine 1400 sine 2100 fade h 0.01 0.4 0.2 vol 0.5

rm -f .gitkeep
cd ../..
```

- [ ] **Step 2: Verify files exist and are reasonable size**

Run: `ls -la public/sounds/`

Expected: 7 .wav files, each under 50KB.

- [ ] **Step 3: Commit**

```bash
git add public/sounds/
git commit -m "feat: add synthesized sound effects for all mascot states"
```
