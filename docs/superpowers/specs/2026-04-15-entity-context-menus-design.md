# Entity Context Menus & Refresh

**Date:** 2026-04-15
**Status:** Draft

## Overview

Add two right-click context menus to the main mascot grid:

1. **Right-click on an entity** → "Remove" — manually deregister a session.
2. **Right-click on empty grid space** → "Refresh" — check every tracked session's parent process and remove dead ones in a single batched, animated removal.

To make "is this entity alive" answerable, the CLI begins reporting the parent PID at registration time and the backend stores it.

## Motivation

Entities currently disappear only when their owning agent explicitly calls `/remove`. When an agent crashes, is killed, or its hook chain is broken, the entity hangs around indefinitely. Users have no way to clear it short of restarting Spacebar. Adding an explicit Remove and a one-click Refresh closes that gap without inventing a heartbeat protocol.

## Liveness Tracking

### `Session` struct (`src-tauri/src/state.rs`)

Add one optional field:

```rust
pub struct Session {
    // ...existing fields
    pub pid: Option<u32>,
}
```

`Option` because (a) sessions registered before this feature shipped have no PID, and (b) the field is still optional in the wire protocol so non-CLI registration paths (e.g. Docker, future SDKs) keep working.

`SessionStore::register` gains a `pid: Option<u32>` parameter and threads it into the stored `Session`. All existing call sites and tests are updated; existing test bodies stay valid by passing `None`.

### CLI (`cli/src/main.rs`)

`Register` command **always** auto-detects the parent PID. No new flag.

```rust
fn parent_pid() -> u32 {
    // SAFETY: getppid is async-signal-safe and always succeeds on POSIX.
    unsafe { libc::getppid() as u32 }
}
```

The CLI's `RegisterBody` gains `pid: Option<u32>` (always `Some(parent_pid())` when sent from the CLI). `libc` is added as a direct dep on the `cli` crate.

**Caveat (documented in code comment near `parent_pid`):** if the CLI is invoked through a wrapper shell that exits immediately, the recorded PID dies right away and Refresh will treat the session as dead. The documented invocation path (Claude Code hooks → `spacebar register …`) makes the CLI a direct child of the agent process, so this is acceptable.

### HTTP layer (`src-tauri/src/server.rs`)

`RegisterRequest` gains `pid: Option<u32>` and forwards it to `SessionStore::register`. No change to `/remove` or `/update`.

### Liveness check

New helper in a dedicated module `src-tauri/src/liveness.rs`:

```rust
pub fn is_alive(pid: u32) -> bool {
    // kill(pid, 0) returns 0 if the process exists and we can signal it.
    // Errno EPERM also means it exists (different uid). ESRCH means dead.
    unsafe { libc::kill(pid as libc::pid_t, 0) == 0
        || *libc::__error() == libc::EPERM }
}
```

Linux uses `__errno_location` instead of `__error`; gate with `cfg(target_os)`. Spacebar is currently macOS-only, so the macOS path is what ships; the Linux branch is a small `cfg` for forward-compat and to keep CI portable if we add it.

Sessions with `pid: None` are **never** considered dead by Refresh — they're skipped.

## Tauri Commands

Two new commands in `src-tauri/src/commands.rs`:

### `show_entity_menu(session_id: String, app: AppHandle, store: State<'_, Arc<SessionStore>>)`

Builds a one-item native menu and pops it at the OS cursor. The menu item's ID encodes the session ID so the global handler can route the click:

```rust
let id = format!("entity-remove:{session_id}");
let remove = MenuItem::with_id(&app, &id, "Remove", true, None::<&str>)?;
let menu = Menu::with_items(&app, &[&remove])?;
let window = app.get_webview_window("main").ok_or("no main window")?;
menu.popup(window.clone())?;
```

### `show_grid_menu(app: AppHandle, store: State<'_, Arc<SessionStore>>)`

Same shape, single item with ID `"grid-refresh"`. On click invokes the refresh routine.

### Menu event routing

Tauri 2 dispatches webview menu events through `App::on_menu_event` (installed once at setup in `lib.rs`). The existing setup handler for the tray uses `TrayIconBuilder::on_menu_event`; we add a parallel `app.on_menu_event(...)` for popup menus, dispatching by ID prefix:

```rust
app.on_menu_event(move |app, event| {
    let id = event.id().as_ref();
    if let Some(session_id) = id.strip_prefix("entity-remove:") {
        let store: State<Arc<SessionStore>> = app.state();
        remove_session(app, &store, session_id);
    } else if id == "grid-refresh" {
        let store: State<Arc<SessionStore>> = app.state();
        let _ = refresh_sessions_inner(app, &store);
    }
    // tray events keep flowing through the tray's own handler
});
```

(`refresh_sessions_inner` is the body of the `refresh_sessions` Tauri command, factored out so both the command and the menu handler share it.)

### Shared removal helper

The current `/remove` HTTP handler in `server.rs` does work that needs to happen for both manual remove and refresh: store mutation, emit `session-removed`, emit `group-removed` or `group-updated`, rebuild tray menu, hide window if empty. Extract this into a free function `remove_session(app: &AppHandle, store: &SessionStore, session_id: &str) -> Option<Session>` in `commands.rs` (or a new `removal.rs` if `commands.rs` grows uncomfortably). Both the HTTP handler and the new Tauri commands call it. No behavioral change to the HTTP path.

### `refresh_sessions(app: AppHandle, store: State<'_, Arc<SessionStore>>)`

```
let dead: Vec<String> = store.all()
    .into_iter()
    .filter(|s| s.pid.map_or(false, |p| !liveness::is_alive(p)))
    .map(|s| s.session_id)
    .collect();

if dead.is_empty() { return Ok(()); }

// Tell the frontend which IDs are about to swipe out, BEFORE we mutate state
// or fire the per-session events. Frontend marks them as "refresh-pending" so
// the standard session-removed handler skips its per-entity exit animation
// and lets the swipe-out CSS class drive removal instead.
app.emit("sessions-refresh-removed", &dead)?;

for sid in &dead {
    remove_session(&app, &store, sid);
}
```

Order matters: the bulk event must fire before the individual `session-removed` events, so the frontend's suppression set is populated when the per-session events arrive.

## Frontend

### `src/main.ts`

Track suppression set and add the bulk listener:

```ts
const refreshPending = new Set<string>();

await listen<string[]>("sessions-refresh-removed", (event) => {
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;
  for (const id of event.payload) {
    refreshPending.add(id);
    const el = grid.querySelector(`[data-session-id="${id}"]`) as HTMLElement | null;
    if (el) el.classList.add("swipe-out");
  }
  // After CSS animation completes, remove from state. Single timer for the batch.
  setTimeout(() => {
    for (const id of event.payload) {
      sessionState.remove(id);
      refreshPending.delete(id);
    }
  }, 420); // animation is 400ms, small buffer
});
```

Existing `session-removed` handler is updated:

```ts
await listen<Session>("session-removed", (event) => {
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;
  if (refreshPending.has(event.payload.sessionId)) return; // bulk handler owns it
  triggerExit(grid, event.payload.sessionId).then(() => {
    sessionState.remove(event.payload.sessionId);
  });
});
```

### `src/mascot-grid.ts`

In `createMascotElement`, add at the end:

```ts
wrapper.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
  invoke("show_entity_menu", { sessionId: session.sessionId });
});
```

In `initMascotGrid`, add a grid-level listener that fires only when the click target isn't already handled:

```ts
grid.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest(".mascot-item, .group-label")) return;
  e.preventDefault();
  invoke("show_grid_menu");
});
```

### `src/styles.css`

Add the swipe-out animation. Reuses the existing transform-based exit feel but with horizontal translation to read as "cleared" rather than "departed":

```css
@keyframes swipe-out-left {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(-40px); opacity: 0; }
}

.mascot-item.swipe-out {
  animation: swipe-out-left 400ms ease-in forwards;
  pointer-events: none;
}
```

No exit sound on refresh (cleanup, not natural exit) — the bulk handler never calls `playStateSound("exiting")`.

## Tooltip — show PID

### Pipeline

`Session.pid` flows: backend → `session-added` / `get_sessions` event payloads → frontend `Session` type in `src/state.ts` (add `pid?: number`).

`tooltip.ts` `doShowTooltip` adds `pid: session.pid` to the `tooltip:show` event payload.

### `src/tooltip-window.ts`

Type updated to include `pid?: number`. New row in the tooltip body, placed after Session and before Agent:

```ts
<div class="tooltip-row"><span class="tooltip-label">PID</span> ${pid ?? "—"}</div>
```

Sessions registered without a PID (e.g. legacy, Docker) display `—`.

## Tray menu

The existing `rebuild_tray_menu` already enumerates sessions. PID is not exposed in the tray (label stays unchanged) — the tray is a quick-access affordance and its label format is already information-dense. No tray code touched.

## Tests

### Rust

- `state.rs` — existing tests adapted: `register` calls now pass `None` for the new `pid` parameter. One new test: `test_register_with_pid_stores_pid`.
- `liveness.rs` — new test module:
  - `is_alive_returns_true_for_self` — `is_alive(std::process::id())` is `true`.
  - `is_alive_returns_false_for_dead_pid` — spawn `sleep 0`, capture PID, wait for exit, assert `is_alive(pid)` is `false`.
- Removal helper extraction — covered by existing HTTP handler tests if any; if there are none, no new tests (the helper is a pure refactor and is covered by the new menu-driven path through manual QA).

### Frontend

No automated tests in this repo today. Manual verification:

1. Right-click an entity → menu appears → click Remove → entity exits with current per-entity animation.
2. Kill an agent process; right-click empty grid space → click Refresh → dead entity (and only the dead entity) swipes left and fades.
3. Multiple dead entities swipe out simultaneously.
4. Refresh with no dead sessions is a no-op (no animation, no events).
5. Tooltip shows PID for sessions registered via the CLI; shows `—` for sessions registered through Docker/legacy paths without a PID.

## Out of scope

- Heartbeat protocol or staleness-based liveness (rejected — see brainstorm options B/C).
- Confirmation prompt on Remove (the action is reversible — the agent can re-register; not worth a dialog).
- Toast/log of "removed N dead sessions" (no toast system exists; refresh result is visible from the UI).
- Surfacing PID in the tray menu.
- Linux/Windows support (Spacebar is macOS-only today; the `cfg(target_os = "linux")` branch in `liveness.rs` is forward-compat only and not exercised in CI).

## Implementation order

1. Backend: `Session.pid`, `SessionStore::register` signature, `RegisterRequest` field. Update tests.
2. CLI: `parent_pid()` + send PID. Add `libc` dep.
3. Extract `remove_session` helper from `server.rs::remove`.
4. `liveness.rs` + tests.
5. New Tauri commands: `show_entity_menu`, `show_grid_menu`, `refresh_sessions`. Register in `lib.rs::invoke_handler`. Install `app.on_menu_event` in `lib.rs::setup` to route popup menu clicks.
6. Frontend: `Session` type adds `pid`, suppression set + bulk listener in `main.ts`, contextmenu listeners in `mascot-grid.ts`, swipe-out CSS.
7. Tooltip: thread `pid` through and render row.
8. Manual QA against the checklist above.
