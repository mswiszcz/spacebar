# Window Vibrancy Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade window-vibrancy to v0.7.1 and let users configure native blur radius, window background color, and background opacity from preferences.

**Architecture:** Replace the hardcoded `apply_vibrancy` call with a configurable Tauri command that reads blur radius from config. Move the CSS background color + opacity from the `#app` container to `body` level so it tints the entire window, not just the content div. Expose a new `apply_window_vibrancy` command so the frontend can re-apply vibrancy when preferences change.

**Tech Stack:** Rust (Tauri v2, window-vibrancy 0.7.1), TypeScript, CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/Cargo.toml` | Modify | Bump window-vibrancy dependency |
| `src-tauri/src/lib.rs` | Modify | Use config values for initial vibrancy, import changes |
| `src-tauri/src/commands.rs` | Modify | Add `apply_window_vibrancy` command |
| `src/styles.css` | Modify | Move bg color/opacity from `#app` to `body` |
| `src/main.ts` | Modify | Call `apply_window_vibrancy` on config changes |
| `src/preferences-page.ts` | Modify | Wire blur slider to trigger native vibrancy update |

---

### Task 1: Upgrade window-vibrancy Dependency

**Files:**
- Modify: `src-tauri/Cargo.toml:16`

- [ ] **Step 1: Bump the dependency version**

In `src-tauri/Cargo.toml`, change:
```toml
window-vibrancy = "0.5"
```
to:
```toml
window-vibrancy = "0.7.1"
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully. The v0.7.1 API is backward-compatible with v0.5 — same `apply_vibrancy` signature, just the `radius` param (4th arg, already `None`) now works.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: upgrade window-vibrancy to 0.7.1"
```

---

### Task 2: Add `apply_window_vibrancy` Tauri Command

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the command to `commands.rs`**

Add this new command at the end of `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn apply_window_vibrancy(app: AppHandle, blur_radius: Option<f64>) -> Result<(), String> {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    apply_vibrancy(
        &window,
        NSVisualEffectMaterial::HudWindow,
        Some(NSVisualEffectState::Active),
        blur_radius,
    )
    .map_err(|e| format!("Failed to apply vibrancy: {e}"))
}
```

- [ ] **Step 2: Register the command in `lib.rs`**

In `src-tauri/src/lib.rs`, add `commands::apply_window_vibrancy` to the `invoke_handler` list:

```rust
.invoke_handler(tauri::generate_handler![
    commands::execute_click,
    commands::get_config,
    commands::save_config,
    commands::get_sessions,
    commands::set_main_always_on_top,
    commands::apply_window_vibrancy,
])
```

- [ ] **Step 3: Use config blur_radius at startup in `lib.rs`**

In `src-tauri/src/lib.rs`, change the hardcoded vibrancy call (line 35) from:

```rust
let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, Some(NSVisualEffectState::Active), None);
```

to:

```rust
let radius = if cfg.theme.blur_radius > 0 {
    Some(cfg.theme.blur_radius as f64)
} else {
    None
};
let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, Some(NSVisualEffectState::Active), radius);
```

Note: `cfg` is already loaded on line 38. Move the `load_config()` call above the vibrancy block so `cfg` is available:

```rust
let window = app.get_webview_window("main").unwrap();

// Load saved config
let cfg = load_config();

// Apply vibrancy with configured blur radius
let radius = if cfg.theme.blur_radius > 0 {
    Some(cfg.theme.blur_radius as f64)
} else {
    None
};
let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, Some(NSVisualEffectState::Active), radius);

// Load saved position
let _ = window.set_position(tauri::PhysicalPosition::new(
    cfg.position.x as i32,
    cfg.position.y as i32,
));
let _ = window.set_always_on_top(cfg.always_on_top);
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add apply_window_vibrancy command with configurable blur radius"
```

---

### Task 3: Move Background Color/Opacity to Window Level

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Move background from `#app` to `body`**

In `src/styles.css`, change the `html, body` rule to include the background:

```css
html, body {
  background: color-mix(in srgb, var(--bg-color, #1a1a2e) calc(var(--bg-opacity, 0.8) * 100%), transparent);
  overflow: hidden;
  user-select: none;
  cursor: default;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
```

And simplify `#app` — remove its background and backdrop-filter since the body now handles it:

```css
#app {
  width: 100vw;
  height: 100vh;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: move background color/opacity to body for full-window tinting"
```

---

### Task 4: Wire Frontend to Re-apply Vibrancy on Config Change

**Files:**
- Modify: `src/main.ts`
- Modify: `src/preferences-page.ts`

- [ ] **Step 1: Update `applyConfig` in `main.ts` to call native vibrancy**

In `src/main.ts`, update the `applyConfig` function to also invoke the vibrancy command. Add at the end of `applyConfig`:

```typescript
function applyConfig(config: Config): void {
  const app = document.getElementById("app")!;
  const grid = app.querySelector(".mascot-grid") as HTMLElement;

  // Apply orientation
  if (grid) {
    grid.classList.toggle("vertical", config.orientation === "vertical");
  }

  // Apply theme as CSS custom properties
  const root = document.documentElement;
  root.style.setProperty("--bg-color", config.theme.backgroundColor);
  root.style.setProperty("--bg-opacity", String(config.theme.backgroundOpacity));
  root.style.setProperty("--accent-color", config.theme.accentColor);

  // Apply size class
  app.className = `size-${config.mascotSize}`;

  // Apply label visibility
  document.querySelectorAll(".mascot-label").forEach((el) => {
    (el as HTMLElement).style.display = config.showLabels ? "block" : "none";
  });

  // Re-apply native vibrancy with new blur radius
  invoke("apply_window_vibrancy", {
    blurRadius: config.theme.blurRadius > 0 ? config.theme.blurRadius : null,
  }).catch(() => {});
}
```

Note: The CSS `--blur-radius` variable is no longer needed (was for `backdrop-filter`), so we remove that `setProperty` call and instead call the Tauri command.

- [ ] **Step 2: Verify the preferences-page.ts blur slider still works**

The existing blur slider in `preferences-page.ts` (line 107) already updates `config.theme.blurRadius` and calls `save()` which emits `config-changed`. The main window's `applyConfig` will now handle re-applying native vibrancy. No changes needed to `preferences-page.ts`.

- [ ] **Step 3: Verify it builds**

Run: `npm run build` (or `npx vite build`)
Expected: Builds successfully.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: re-apply native vibrancy on blur radius preference change"
```

---

### Task 5: Manual Testing

- [ ] **Step 1: Run the app**

Run: `npm run tauri dev`

- [ ] **Step 2: Verify initial vibrancy**

The window should have the frosted glass HudWindow effect with the default blur radius (20).

- [ ] **Step 3: Test blur radius slider**

Right-click to open Preferences. Move the Blur slider. The native vibrancy blur should update in real time on the main window.

- [ ] **Step 4: Test background color**

Change the Background color picker. The entire window background (not just the container) should tint with the chosen color.

- [ ] **Step 5: Test opacity**

Move the Opacity slider. The background color transparency should change across the entire window.

- [ ] **Step 6: Test persistence**

Close and reopen the app. Verify saved blur radius, background color, and opacity are applied on startup.
