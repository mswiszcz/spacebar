# Docker Container Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Claude Code instances running inside Docker containers to register with the Spacebar desktop app via HTTP.

**Architecture:** Add `bind` and `port` fields to the existing config struct. The server reads these on startup — if `port` is `None` (first run), it binds to a random port and persists it. The CLI gains a `SPACEBAR_HOST` env var override that bypasses port file discovery and auto-launch.

**Tech Stack:** Rust (Tauri backend + CLI), Axum, serde, clap, ureq

**Spec:** `docs/superpowers/specs/2026-04-07-docker-registration-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-tauri/src/config.rs` | Modify | Add `bind` and `port` fields to `Config` |
| `src-tauri/src/server.rs` | Modify | Use config bind/port, persist port on first run, handle port conflicts |
| `cli/src/main.rs` | Modify | Support `SPACEBAR_HOST` env var, skip port file + auto-launch when set |

---

### Task 1: Add `bind` and `port` fields to Config

**Files:**
- Modify: `src-tauri/src/config.rs:6-34` (Config struct)
- Modify: `src-tauri/src/config.rs:121-149` (Default impl)

- [ ] **Step 1: Add the fields and default function**

In `src-tauri/src/config.rs`, add a default function and two new fields to `Config`:

```rust
fn default_bind() -> String {
    "127.0.0.1".into()
}
```

Add to the `Config` struct (after the `states` field):

```rust
#[serde(default = "default_bind")]
pub bind: String,
#[serde(default)]
pub port: Option<u16>,
```

Add to `Config::default()`:

```rust
bind: default_bind(),
port: None,
```

- [ ] **Step 2: Add test for config with new fields**

Add to the existing `tests` module in `config.rs`:

```rust
#[test]
fn test_bind_and_port_defaults() {
    // Existing config JSON without bind/port should deserialize with defaults
    let json = r##"{
        "orientation": "horizontal",
        "alwaysOnTop": true,
        "mascotSize": "medium",
        "showLabels": true,
        "showTooltips": true,
        "position": {"x": 100, "y": 100},
        "theme": {
            "backgroundColor": "#1a1a2e",
            "backgroundOpacity": 0.8,
            "blurRadius": 20,
            "accentColor": "#E8825A"
        }
    }"##;
    let parsed: Config = serde_json::from_str(json).unwrap();
    assert_eq!(parsed.bind, "127.0.0.1");
    assert_eq!(parsed.port, None);
}

#[test]
fn test_bind_and_port_explicit() {
    let json = r##"{
        "orientation": "horizontal",
        "alwaysOnTop": true,
        "mascotSize": "medium",
        "showLabels": true,
        "showTooltips": true,
        "position": {"x": 100, "y": 100},
        "theme": {
            "backgroundColor": "#1a1a2e",
            "backgroundOpacity": 0.8,
            "blurRadius": 20,
            "accentColor": "#E8825A"
        },
        "bind": "0.0.0.0",
        "port": 9876
    }"##;
    let parsed: Config = serde_json::from_str(json).unwrap();
    assert_eq!(parsed.bind, "0.0.0.0");
    assert_eq!(parsed.port, Some(9876));
}
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test`
Expected: All config tests pass, including the two new ones.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add bind and port fields to config"
```

---

### Task 2: Use config bind/port in server, persist on first run

**Files:**
- Modify: `src-tauri/src/server.rs:130-152` (start_server function)

- [ ] **Step 1: Update `start_server` to accept and use config values**

Replace the `start_server` function in `server.rs`:

```rust
pub async fn start_server(store: Arc<SessionStore>, app_handle: AppHandle) -> u16 {
    let state = AppState { store, app_handle: app_handle.clone() };

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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo build`
Expected: Compiles without errors.

- [ ] **Step 3: Manual smoke test**

Run: `cd src-tauri && cargo run`
Check: `~/.spacebar/config.json` now has a `port` field with a number. Kill and restart — it should reuse the same port. Verify with `cat ~/.spacebar.port`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/server.rs
git commit -m "feat: use persisted port from config, fallback on conflict"
```

---

### Task 3: CLI `SPACEBAR_HOST` env var support

**Files:**
- Modify: `cli/src/main.rs:77-84` (get_base_url function)
- Modify: `cli/src/main.rs:134-159` (Register command match arm)

- [ ] **Step 1: Add `get_base_url_from_env` function**

Add this function in `cli/src/main.rs` above the existing `get_base_url`:

```rust
fn get_base_url_from_env() -> Option<String> {
    std::env::var("SPACEBAR_HOST").ok().map(|host| format!("http://{host}"))
}
```

- [ ] **Step 2: Update `main` to use env var**

In the `Commands::Register` match arm (around line 143), replace the base_url logic:

```rust
Commands::Register {
    agent,
    session_id,
    on_click,
    group,
} => {
    let base_url = if let Some(url) = get_base_url_from_env() {
        // Docker/remote mode — skip auto-launch, connect directly
        url
    } else {
        match get_base_url() {
            Some(url) if is_app_reachable(&url) => url,
            _ => launch_and_wait(),
        }
    };
    let pwd = std::env::var("PWD").ok();
    let body = RegisterBody {
        agent,
        session_id,
        on_click,
        pwd,
        display_name: group,
    };
    ureq::post(format!("{base_url}/register"))
        .send_json(&body)
        .map(|_| ())
}
```

- [ ] **Step 3: Update `Update`, `Remove`, and `Health` commands similarly**

For each of the other three commands, replace `get_base_url_or_exit()` with the env-aware version:

```rust
Commands::Update { session_id, state, no_sound } => {
    let base_url = get_base_url_from_env().unwrap_or_else(|| get_base_url_or_exit());
    let body = UpdateBody { session_id, state, no_sound };
    ureq::post(format!("{base_url}/update"))
        .send_json(&body)
        .map(|_| ())
}
Commands::Remove { session_id } => {
    let base_url = get_base_url_from_env().unwrap_or_else(|| get_base_url_or_exit());
    let body = RemoveBody { session_id };
    ureq::post(format!("{base_url}/remove"))
        .send_json(&body)
        .map(|_| ())
}
Commands::Health => {
    let base_url = get_base_url_from_env().unwrap_or_else(|| get_base_url_or_exit());
    ureq::get(format!("{base_url}/health"))
        .call()
        .map(|_| ())
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd cli && cargo build`
Expected: Compiles without errors.

- [ ] **Step 5: Manual smoke test**

Test without env var (should behave as before):
```bash
cd cli && cargo run -- health
```

Test with env var:
```bash
SPACEBAR_HOST=127.0.0.1:$(cat ~/.spacebar.port) cargo run -- health
```

Both should return successfully if Spacebar is running.

- [ ] **Step 6: Commit**

```bash
git add cli/src/main.rs
git commit -m "feat: support SPACEBAR_HOST env var for Docker connectivity"
```
