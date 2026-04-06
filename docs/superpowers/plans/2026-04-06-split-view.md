# Split View Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Spacebar to participate in macOS Split View so it can live as a thin vertical strip alongside a full-screen app in a dedicated Space.

**Architecture:** New `split_view.rs` Rust module handles NSWindow native APIs (collection behavior, fullscreen toggle, activation policy). Frontend renders a green hover button and manages split-view layout state via CSS class toggling and Tauri event listeners.

**Tech Stack:** Rust (Cocoa/objc bindings), TypeScript, CSS, Tauri v2 commands and events

---

### File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src-tauri/src/split_view.rs` | Native NSWindow APIs: collection behavior, toggle fullscreen, activation policy, fullscreen notifications |
| Modify | `src-tauri/src/lib.rs` | Register module, call setup on init, register new command |
| Modify | `src-tauri/src/commands.rs` | Add `toggle_split_view` command |
| Modify | `src-tauri/src/config.rs` | Add `SplitViewConfig` struct and field |
| Modify | `src/main.ts` | Listen for split-view events, manage orientation state, update `resizeWindow` |
| Modify | `src/styles.css` | Green button styles, split-view layout overrides, scrollbar styling |
| Modify | `src/preferences-page.ts` | Add overflow behavior dropdown to layout tab, add `splitView` to Config interface |

---

### Task 1: Add SplitViewConfig to Config

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add `SplitViewConfig` struct and field to `Config`**

In `src-tauri/src/config.rs`, add the struct after `SnapConfig`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitViewConfig {
    pub overflow_behavior: String,
}

impl Default for SplitViewConfig {
    fn default() -> Self {
        Self {
            overflow_behavior: "scroll".into(),
        }
    }
}
```

Add the field to the `Config` struct (after `snap`):

```rust
    #[serde(default)]
    pub split_view: SplitViewConfig,
```

Add it to `Config::default()` (after `snap: SnapConfig::default()`):

```rust
            split_view: SplitViewConfig::default(),
```

- [ ] **Step 2: Add backward-compat test**

Add to the existing `tests` module in `config.rs`:

```rust
    #[test]
    fn test_split_view_config_backward_compat() {
        // Config without split_view field should deserialize with defaults
        let json = r##"{
            "orientation": "horizontal",
            "alwaysOnTop": true,
            "mascotSize": "medium",
            "showLabels": true,
            "showTooltips": true,
            "position": {"x": 100, "y": 100},
            "sound": {"enabled": true, "volume": 0.5},
            "theme": {
                "backgroundColor": "#1a1a2e",
                "backgroundOpacity": 0.8,
                "blurRadius": 20,
                "accentColor": "#E8825A"
            }
        }"##;
        let parsed: Config = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.split_view.overflow_behavior, "scroll");
    }
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass including new `test_split_view_config_backward_compat`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add SplitViewConfig to config with backward compat"
```

---

### Task 2: Create split_view.rs Native Module

**Files:**
- Create: `src-tauri/src/split_view.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `src-tauri/src/split_view.rs`**

This module exposes two functions: `configure_for_split_view` (called once at startup) and `is_fullscreen` (called by the frontend via Tauri command to detect state changes). The toggle itself is handled in `commands.rs`.

```rust
#![allow(deprecated, unexpected_cfgs)]

use cocoa::base::id;
use cocoa::foundation::NSUInteger;
use objc::{msg_send, sel, sel_impl};

// NSWindowCollectionBehavior flags
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY: NSUInteger = 1 << 8;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_NONE: NSUInteger = 1 << 9;

// NSWindowStyleMask fullscreen flag
const NS_WINDOW_STYLE_MASK_FULL_SCREEN: NSUInteger = 1 << 14;

/// Configure the main window to be eligible as a Split View secondary tile.
/// Call once during app setup.
pub fn configure_for_split_view(window: &tauri::WebviewWindow) {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;
        let current_behavior: NSUInteger = msg_send![ns_window, collectionBehavior];
        let new_behavior = (current_behavior & !NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_NONE)
            | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY;
        let _: () = msg_send![ns_window, setCollectionBehavior: new_behavior];
    }
}

/// Check if the main window is currently in fullscreen (Split View).
pub fn is_fullscreen(window: &tauri::WebviewWindow) -> bool {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;
        let mask: NSUInteger = msg_send![ns_window, styleMask];
        mask & NS_WINDOW_STYLE_MASK_FULL_SCREEN != 0
    }
}
```

- [ ] **Step 2: Register the module in `lib.rs`**

Add `mod split_view;` after `mod state;` at the top of `src-tauri/src/lib.rs`:

```rust
mod split_view;
```

In the `setup` closure (after `set_window_blur_radius` call, around line 105), add:

```rust
            // Configure window for Split View eligibility
            split_view::configure_for_split_view(&window);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/split_view.rs src-tauri/src/lib.rs
git commit -m "feat: add split_view native module with fullScreenAuxiliary config"
```

---

### Task 3: Add Tauri Commands for Split View

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `toggle_split_view` and `is_split_view` commands**

Add to `src-tauri/src/commands.rs` (after `set_blur_radius`):

```rust
#[tauri::command]
pub fn toggle_split_view(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    let entering = !crate::split_view::is_fullscreen(&window);

    if entering {
        window.set_resizable(true).map_err(|e| format!("{e}"))?;
        app.set_activation_policy(tauri::ActivationPolicy::Regular);
    } else {
        window.set_resizable(false).map_err(|e| format!("{e}"))?;
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }

    unsafe {
        let ns_window = window.ns_window().map_err(|e| format!("{e}"))? as cocoa::base::id;
        let _: () = objc::msg_send![ns_window, toggleFullScreen: cocoa::base::nil];
    }

    Ok(())
}

#[tauri::command]
pub fn is_split_view(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    Ok(crate::split_view::is_fullscreen(&window))
}
```

Add the required imports at the top of `commands.rs`. The `unsafe` block and `cocoa`/`objc` imports are needed. Add after the existing imports:

```rust
#[allow(deprecated, unexpected_cfgs)]
use cocoa;
use objc;
```

- [ ] **Step 2: Register commands in `lib.rs`**

In `src-tauri/src/lib.rs`, add the new commands to the `invoke_handler` list (after `commands::get_version`):

```rust
            commands::toggle_split_view,
            commands::is_split_view,
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add toggle_split_view and is_split_view Tauri commands"
```

---

### Task 4: Add Green Button CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add green button and split-view styles**

Append to the end of `src/styles.css`:

```css
/* ── Split View green button ─────────────────────── */

.split-view-btn {
  position: fixed;
  top: 6px;
  left: 6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #28c840;
  border: 1px solid #1ea532;
  cursor: pointer;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 100;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

#app:hover .split-view-btn {
  opacity: 1;
}

.split-view-btn:hover {
  background: #2dda47;
}

/* Expand arrows icon on hover */
.split-view-btn::after {
  content: "⤢";
  font-size: 8px;
  color: rgba(0, 0, 0, 0.6);
  opacity: 0;
  transition: opacity 100ms ease;
  line-height: 1;
}

.split-view-btn:hover::after {
  opacity: 1;
}

/* ── Split View layout overrides ─────────────────── */

#app.split-view {
  height: 100vh;
}

.split-view .mascot-grid {
  flex-direction: column;
  align-items: flex-start;
  height: 100%;
}

/* Scroll overflow mode */
.split-view .mascot-grid.overflow-scroll {
  overflow-y: auto;
  overflow-x: hidden;
}

/* Thin scrollbar */
.split-view .mascot-grid.overflow-scroll::-webkit-scrollbar {
  width: 4px;
}

.split-view .mascot-grid.overflow-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.split-view .mascot-grid.overflow-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--accent-color, #E8825A) 40%, transparent);
  border-radius: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add split-view green button and layout CSS"
```

---

### Task 5: Frontend Split View Logic

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add `splitView` to the `Config` interface**

In `src/main.ts`, add `splitView` to the `Config` interface (after the `snap` field):

```typescript
  splitView: { overflowBehavior: string };
```

- [ ] **Step 2: Add the green button element and split-view state management**

In the `init()` function, after `initMascotGrid(app);` (line 174), add the green button creation:

```typescript
  // Create split-view green button
  const splitBtn = document.createElement("button");
  splitBtn.className = "split-view-btn";
  splitBtn.title = "Enter Split View";
  splitBtn.addEventListener("click", async (e) => {
    e.stopPropagation(); // Prevent window drag
    await invoke("toggle_split_view");
  });
  app.appendChild(splitBtn);
```

- [ ] **Step 3: Add split-view state tracking and resize event listener**

After the green button code, add the state tracking variables:

```typescript
  // Split View state
  let _isSplitView = false;
  let _preSplitOrientation: string | null = null;
```

Add a listener for the `tauri://resize` event to detect fullscreen state changes. Place it after the `tauri://move` listener block (after line 301):

```typescript
  // Detect Split View (fullscreen) state changes via resize events
  await listen("tauri://resize", async () => {
    const inSplitView = await invoke<boolean>("is_split_view");
    if (inSplitView === _isSplitView) return;
    _isSplitView = inSplitView;

    if (inSplitView) {
      // Entering Split View
      _preSplitOrientation = config.orientation;
      app.classList.add("split-view");
      config.orientation = "vertical";

      // Apply overflow mode
      const grid = document.querySelector(".mascot-grid") as HTMLElement;
      if (grid) {
        const overflow = config.splitView?.overflowBehavior ?? "scroll";
        grid.classList.toggle("overflow-scroll", overflow === "scroll");
      }

      splitBtn.title = "Exit Split View";
      applyConfig(config);
    } else {
      // Exiting Split View
      app.classList.remove("split-view");

      const grid = document.querySelector(".mascot-grid") as HTMLElement;
      if (grid) {
        grid.classList.remove("overflow-scroll");
      }

      if (_preSplitOrientation) {
        config.orientation = _preSplitOrientation;
        _preSplitOrientation = null;
      }

      splitBtn.title = "Enter Split View";
      applyConfig(config);
      resizeWindow();
    }
  });
```

- [ ] **Step 4: Handle shrink overflow mode in `resizeWindow`**

In the `resizeWindow()` function, add shrink logic at the beginning (after `if (!grid) return;`):

```typescript
  // In split view, macOS controls the window size — don't resize it ourselves.
  // But do handle shrink overflow mode if configured.
  if (document.getElementById("app")?.classList.contains("split-view")) {
    const cfg = await invoke<Config>("get_config");
    if (cfg.splitView?.overflowBehavior === "shrink") {
      const sizes = ["large", "medium", "small"] as const;
      const appEl = document.getElementById("app")!;
      const containerHeight = window.innerHeight;

      grid.classList.remove("overflow-scroll");
      for (const size of sizes) {
        appEl.className = appEl.className.replace(/size-\w+/, `size-${size}`);
        await new Promise(r => requestAnimationFrame(r));
        if (grid.scrollHeight <= containerHeight) break;
      }

      // If still overflowing at small, fall back to scroll
      if (grid.scrollHeight > containerHeight) {
        grid.classList.add("overflow-scroll");
      }
    }
    return;
  }
```

- [ ] **Step 5: Verify the app compiles and runs**

Run: `npm run build && cd src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: add split-view frontend logic with green button and state management"
```

---

### Task 6: Add Overflow Preference to Preferences Panel

**Files:**
- Modify: `src/preferences-page.ts`

- [ ] **Step 1: Add `splitView` to the Config interface in preferences**

In `src/preferences-page.ts`, add `splitView` to the `Config` interface (after the `snap` field on line 18):

```typescript
  splitView: { overflowBehavior: string };
```

- [ ] **Step 2: Add overflow dropdown to the layout page**

In the `renderLayoutPage` function, add a new row after the "Show Tooltips" row (before the closing `</div>` of `prefs-section`):

```typescript
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Split View Overflow</span>
            <span class="prefs-row-hint">How to handle too many mascots in Split View</span>
          </div>
          <select class="prefs-select" id="pref-split-overflow">
            <option value="scroll" ${(config.splitView?.overflowBehavior ?? "scroll") === "scroll" ? "selected" : ""}>Scroll</option>
            <option value="shrink" ${config.splitView?.overflowBehavior === "shrink" ? "selected" : ""}>Auto-shrink</option>
          </select>
        </div>
```

- [ ] **Step 3: Bind the overflow select control**

In `init()`, after the existing `bindCheckbox("#pref-show-tooltips", ...)` call (around line 90), add:

```typescript
  bindSelect("#pref-split-overflow", (v) => {
    if (!config.splitView) config.splitView = { overflowBehavior: "scroll" };
    config.splitView.overflowBehavior = v;
    save();
  });
```

- [ ] **Step 4: Verify the preferences page builds**

Run: `npm run build`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: add split view overflow preference to layout settings"
```

---

### Task 7: Manual Testing & Polish

**Files:** None (testing only)

- [ ] **Step 1: Build and run the app**

Run: `npm run tauri dev`

- [ ] **Step 2: Test green button visibility**

1. Hover over the Spacebar window — green button should fade in at top-left
2. Move mouse away — button should fade out
3. Hover over the green button — should show expand arrows icon

- [ ] **Step 3: Test Split View entry**

1. Click the green button
2. macOS should present the Split View picker (choose another app to tile with)
3. Spacebar should appear as a thin vertical strip on one side
4. Mascots should be vertical, top-aligned

- [ ] **Step 4: Test Split View exit**

1. Hover over Spacebar in Split View — green button should appear
2. Click it — should exit Split View
3. Orientation should restore to previous setting
4. Window should return to normal floating bar behavior (non-resizable)

- [ ] **Step 5: Test overflow behaviors**

1. Open Preferences > Layout > Split View Overflow
2. Set to "Scroll" — in Split View with many agents, scrollbar should appear
3. Set to "Auto-shrink" — mascot size should reduce to fit
4. With very many agents at "Auto-shrink", should fall back to scroll

- [ ] **Step 6: Test edge cases**

1. Enter Split View while snapped to edge — should work, snap restores on exit
2. Open preferences while in Split View — preferences window should open normally
3. Agents registering/deregistering while in Split View — should render correctly

- [ ] **Step 7: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: polish split view behavior after manual testing"
```
