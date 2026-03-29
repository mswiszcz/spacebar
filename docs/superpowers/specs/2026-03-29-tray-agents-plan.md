# Tray Menu: Show Spawned Agents with State

## Overview
Extend the system tray menu to dynamically display all active agent sessions with their current state. The menu rebuilds whenever sessions change (register, update, remove).

## Business Requirements
- Every spawned agent appears in the tray menu with its state
- Menu updates in real-time as agents register, change state, or exit
- Clicking an agent menu item executes its `on_click` command (focuses terminal)
- Static items (Show, Hide, Quit) remain at the bottom

## Implementation Steps

### 1. Create tray menu rebuild function
**File**: `src-tauri/src/lib.rs`
- Extract a `rebuild_tray_menu(app: &AppHandle, store: &SessionStore)` function
- Menu structure:
  ```
  ── Agents ──────────────  (disabled header, only if agents exist)
  claude-code (sess-1) · thinking
  claude-code (sess-2) · idle
  ────────────────────────
  Show
  Hide
  ────────────────────────
  Quit Agent Monitor
  ```
- Each agent item ID = session_id for click routing
- Use `app.tray_by_id("main")` to get the tray, call `set_menu()`

### 2. Store tray with known ID
**File**: `src-tauri/src/lib.rs`
- Add `.id("main")` to `TrayIconBuilder` so we can retrieve it later

### 3. Call rebuild on session changes
**File**: `src-tauri/src/server.rs`
- After each `register()`, `update()`, `remove()` call, invoke `rebuild_tray_menu`
- AppState already has `app_handle` and `store` — pass both to the rebuild function

### 4. Route agent menu clicks to execute_click
**File**: `src-tauri/src/lib.rs`
- In `on_menu_event`, for unknown IDs (not "show"/"hide"), treat as session_id
- Look up session in store, execute `on_click` command

## Files to Modify
- [x] `src-tauri/src/lib.rs` — tray builder ID, rebuild function, click handler
- [x] `src-tauri/src/server.rs` — call rebuild after session mutations

## Definition of Done
- Tray menu shows all active agents with current state
- Menu updates live on register/update/remove
- Clicking agent item focuses its terminal
- Static menu items still work
