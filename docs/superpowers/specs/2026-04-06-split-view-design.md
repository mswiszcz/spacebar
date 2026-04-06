# Split View Support for macOS Spaces

**Date:** 2026-04-06
**Status:** Approved

## Goal

Allow Spacebar to participate in macOS Split View, so it can live as a thin vertical strip alongside a full-screen app (e.g. Firefox) in a dedicated Space/workspace.

## Requirements

- User can enter Split View via a green button that appears on hover (mimicking macOS traffic light)
- Spacebar takes the narrow secondary tile; the paired app gets the rest of the screen
- Orientation is forced to vertical in Split View, restored to user preference on exit
- Mascots are compact and top-aligned within the full-height strip
- Overflow when mascots exceed visible height is user-configurable: scroll or auto-shrink
- Exiting Split View restores previous orientation, position, and window size

## Approach

Hybrid: custom HTML/CSS green button in the frontend triggers native `NSWindow` APIs via Tauri commands. No title bar or window decorations needed.

## Architecture

### 1. Native Window Configuration (Rust)

**New module: `src-tauri/src/split_view.rs`**

Responsibilities:
- Set `NSWindow.collectionBehavior` to include `.fullScreenAuxiliary` on app startup, making Spacebar eligible as a Split View secondary tile
- Expose `toggle_split_view` function that calls `NSWindow.toggleFullScreen:`
- Temporarily switch activation policy from `Accessory` to `Regular` when entering Split View (required for macOS to allow tiling), and back to `Accessory` on exit
- Listen for `NSWindowDidEnterFullScreenNotification` and `NSWindowDidExitFullScreenNotification` to emit Tauri events (`split-view-entered`, `split-view-exited`)

**Window resizability:**
- Set `resizable: true` in `tauri.conf.json` (required for Split View)
- Constrain min width to mascot size + padding (~70px), max width to ~120px to keep the strip thin
- No max height constraint (macOS controls height in Split View)

### 2. Tauri Commands

**`toggle_split_view`** — calls native `toggleFullScreen:` on the main window. Single command handles both enter and exit since macOS toggles the state.

### 3. Frontend: Green Button

**Element:** A 12px green circle (`#28c840`) positioned fixed at top-left of `#app` with ~6px margin.

**Visibility:**
- Hidden by default (`opacity: 0`)
- Fades in (`opacity: 1`, ~150ms transition) when `#app` is hovered
- On hover over the button itself, shows expand/collapse arrows via CSS `::after` pseudo-element

**Behavior:**
- Click calls `invoke("toggle_split_view")`
- No drag-start on click (must stop propagation to prevent window dragging)

### 4. Frontend: Split View Layout

**On `split-view-entered` event:**
1. Save current orientation to runtime state (`preSplitOrientation`)
2. Add class `split-view` to `#app`
3. Force orientation to `"vertical"` via `applyConfig`
4. Apply overflow behavior from config

**On `split-view-exited` event:**
1. Remove class `split-view` from `#app`
2. Restore orientation from `preSplitOrientation`
3. Restore saved position
4. Resume content-driven sizing via `resizeWindow()`

**CSS for `.split-view`:**
- `#app.split-view`: `height: 100vh`
- `.split-view .mascot-grid`: `flex-direction: column`, top-aligned, height unconstrained
- Overflow scroll mode: `overflow-y: auto` on mascot grid, thin 4px scrollbar styled with accent color translucent thumb, no track
- Overflow shrink mode: JavaScript steps down `--mascot-size` (large -> medium -> small) until all mascots fit; falls back to scroll if still overflowing at small

### 5. Config Changes

**New field in config:**

```rust
#[serde(default)]
pub split_view: SplitViewConfig,
```

```rust
pub struct SplitViewConfig {
    pub overflow_behavior: String, // "scroll" | "shrink"
}

impl Default for SplitViewConfig {
    fn default() -> Self {
        Self {
            overflow_behavior: "scroll".into(),
        }
    }
}
```

**TypeScript config interface addition:**

```typescript
splitView: { overflowBehavior: "scroll" | "shrink" };
```

Backward compatible — missing field deserializes to default.

### 6. Preferences Panel

Add an "Overflow in Split View" dropdown to the layout section of preferences:
- Options: "Scroll" / "Auto-shrink"
- Only visible/relevant when in or configuring Split View behavior

## What Does NOT Change

- Mascot rendering, animations, state handling
- Tooltip system
- Sound system
- Snap-to-edge behavior (disabled/irrelevant during Split View)
- Group rendering and rename functionality

## Edge Cases

- **No agents registered:** Split View still works, window is just an empty strip. When agents register, mascots appear from the top as usual.
- **Entering Split View while snapped:** Snap state is preserved in config but inactive during Split View. On exit, snap is restored.
- **Preferences panel open during Split View:** Preferences modal works normally within the strip (may need scroll if panel is taller than viewport).
- **Multiple monitors:** Split View is per-Space per-monitor; macOS handles this natively.
- **User manually resizes strip width:** macOS allows dragging the Split View divider. Spacebar should respect whatever width macOS gives it — mascots stay top-aligned, single column.
