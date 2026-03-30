# Edge Snapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-edge window snapping with configurable padding, auto-orientation switching, and a settings toggle.

**Architecture:** All snap logic lives in the TypeScript frontend. The Rust backend only adds the `SnapConfig` struct for persistence. On drag end (debounced `tauri://move`), the frontend detects proximity to screen edges, snaps the window centered on the closest edge, and auto-switches orientation to match the edge axis.

**Tech Stack:** Rust (Tauri config), TypeScript (Tauri window/monitor APIs), HTML (preferences UI)

---

### Task 1: Add `SnapConfig` to Rust config

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add the `SnapConfig` struct**

In `src-tauri/src/config.rs`, add the new struct after `ThemeConfig`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapConfig {
    pub enabled: bool,
    pub edge_padding: u32,
    pub snapped_edge: Option<String>,
}

impl Default for SnapConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            edge_padding: 4,
            snapped_edge: None,
        }
    }
}
```

- [ ] **Step 2: Add `snap` field to `Config` struct**

Add this field to the `Config` struct (after `group_renames`):

```rust
    #[serde(default)]
    pub snap: SnapConfig,
```

And in the `Default` impl for `Config`, add:

```rust
            snap: SnapConfig::default(),
```

- [ ] **Step 3: Add a backward-compat test**

Add a test in the existing `#[cfg(test)] mod tests` block:

```rust
    #[test]
    fn test_snap_config_backward_compat() {
        // Config without snap field should deserialize with defaults
        let json = r#"{
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
        }"#;
        let parsed: Config = serde_json::from_str(json).unwrap();
        assert!(!parsed.snap.enabled);
        assert_eq!(parsed.snap.edge_padding, 4);
        assert!(parsed.snap.snapped_edge.is_none());
    }
```

- [ ] **Step 4: Run the tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass, including the new `test_snap_config_backward_compat`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat(config): add SnapConfig for edge snapping"
```

---

### Task 2: Update TypeScript `Config` interfaces

**Files:**
- Modify: `src/main.ts`
- Modify: `src/preferences-page.ts`

- [ ] **Step 1: Update Config interface in `main.ts`**

In `src/main.ts`, add the `snap` field to the `Config` interface (after `theme`):

```typescript
  snap: { enabled: boolean; edgePadding: number; snappedEdge: string | null };
```

- [ ] **Step 2: Update Config interface in `preferences-page.ts`**

In `src/preferences-page.ts`, add the same `snap` field to the `Config` interface (after `theme`):

```typescript
  snap: { enabled: boolean; edgePadding: number; snappedEdge: string | null };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/preferences-page.ts
git commit -m "feat(types): add snap config to TypeScript interfaces"
```

---

### Task 3: Add snap detection and positioning logic

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add `currentMonitor` and `PhysicalPosition` imports**

In `src/main.ts`, update the window import line:

```typescript
import { getCurrentWindow, LogicalSize, currentMonitor, PhysicalPosition } from "@tauri-apps/api/window";
```

- [ ] **Step 2: Add snap constants and helper function**

After the `Config` interface in `src/main.ts`, add:

```typescript
const SNAP_THRESHOLD = 50;

function computeSnapPosition(
  windowX: number,
  windowY: number,
  windowWidth: number,
  windowHeight: number,
  monitorX: number,
  monitorY: number,
  monitorWidth: number,
  monitorHeight: number,
  edgePadding: number,
): { edge: string; x: number; y: number } | null {
  const distTop = windowY - monitorY;
  const distBottom = (monitorY + monitorHeight) - (windowY + windowHeight);
  const distLeft = windowX - monitorX;
  const distRight = (monitorX + monitorWidth) - (windowX + windowWidth);

  const edges: { edge: string; dist: number }[] = [];
  if (distTop < SNAP_THRESHOLD) edges.push({ edge: "top", dist: Math.abs(distTop) });
  if (distBottom < SNAP_THRESHOLD) edges.push({ edge: "bottom", dist: Math.abs(distBottom) });
  if (distLeft < SNAP_THRESHOLD) edges.push({ edge: "left", dist: Math.abs(distLeft) });
  if (distRight < SNAP_THRESHOLD) edges.push({ edge: "right", dist: Math.abs(distRight) });

  if (edges.length === 0) return null;

  edges.sort((a, b) => a.dist - b.dist);
  const closest = edges[0];

  let x: number;
  let y: number;

  switch (closest.edge) {
    case "top":
      x = monitorX + Math.round((monitorWidth - windowWidth) / 2);
      y = monitorY + edgePadding;
      break;
    case "bottom":
      x = monitorX + Math.round((monitorWidth - windowWidth) / 2);
      y = monitorY + monitorHeight - windowHeight - edgePadding;
      break;
    case "left":
      x = monitorX + edgePadding;
      y = monitorY + Math.round((monitorHeight - windowHeight) / 2);
      break;
    case "right":
      x = monitorX + monitorWidth - windowWidth - edgePadding;
      y = monitorY + Math.round((monitorHeight - windowHeight) / 2);
      break;
    default:
      return null;
  }

  return { edge: closest.edge, x, y };
}
```

- [ ] **Step 3: Replace the `tauri://move` listener with debounced snap logic**

Replace the existing `tauri://move` listener block in `init()`:

```typescript
  // Save window position on move (only position, not full config)
  await listen("tauri://move", async () => {
    const appWindow = getCurrentWindow();
    const pos = await appWindow.outerPosition();
    await invoke("save_position", { x: pos.x, y: pos.y });
  });
```

With:

```typescript
  // Save window position on move, with snap detection
  let snapDebounce: number | null = null;
  await listen("tauri://move", async () => {
    const appWindow = getCurrentWindow();
    const pos = await appWindow.outerPosition();
    await invoke("save_position", { x: pos.x, y: pos.y });

    if (!config.snap.enabled) return;

    if (snapDebounce !== null) clearTimeout(snapDebounce);
    snapDebounce = window.setTimeout(async () => {
      snapDebounce = null;
      const monitor = await currentMonitor();
      if (!monitor) return;

      const size = await appWindow.outerSize();
      const currentPos = await appWindow.outerPosition();

      const snap = computeSnapPosition(
        currentPos.x, currentPos.y,
        size.width, size.height,
        monitor.position.x, monitor.position.y,
        monitor.size.width, monitor.size.height,
        config.snap.edgePadding * monitor.scaleFactor,
      );

      if (snap) {
        await appWindow.setPosition(new PhysicalPosition(snap.x, snap.y));
        config.snap.snappedEdge = snap.edge;
        const newOrientation = (snap.edge === "left" || snap.edge === "right") ? "vertical" : "horizontal";
        if (config.orientation !== newOrientation) {
          config.orientation = newOrientation;
          applyConfig(config);
        }
      } else {
        config.snap.snappedEdge = null;
      }

      await invoke("save_config", { config });
    }, 150);
  });
```

Note: `config` is already loaded at the top of `init()` as `const config = await invoke<Config>("get_config");` — change it from `const` to `let` so it can be reassigned when config-changed events arrive.

- [ ] **Step 4: Update config variable to `let`**

In `init()`, change:

```typescript
  const config = await invoke<Config>("get_config");
```

To:

```typescript
  let config = await invoke<Config>("get_config");
```

- [ ] **Step 5: Listen for config-changed to keep local config in sync**

Add this listener in `init()`, after the `applyConfig(config)` call:

```typescript
  await listen<Config>("config-changed", (event) => {
    config = event.payload;
    applyConfig(config);
  });
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts
git commit -m "feat: add edge snap detection and positioning logic"
```

---

### Task 4: Add re-centering on resize

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update `resizeWindow` to accept config and re-center when snapped**

Replace the existing `resizeWindow` function:

```typescript
async function resizeWindow(): Promise<void> {
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;

  const appWindow = getCurrentWindow();
  requestAnimationFrame(async () => {
    const width = grid.scrollWidth;
    const height = grid.scrollHeight;
    await appWindow.setSize(
      new LogicalSize(Math.max(width, 64), Math.max(height, 64))
    );
  });
}
```

With:

```typescript
let _snapConfig: { enabled: boolean; edgePadding: number; snappedEdge: string | null } | null = null;

async function resizeWindow(): Promise<void> {
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;

  const appWindow = getCurrentWindow();
  requestAnimationFrame(async () => {
    const width = grid.scrollWidth;
    const height = grid.scrollHeight;
    await appWindow.setSize(
      new LogicalSize(Math.max(width, 64), Math.max(height, 64))
    );

    // Re-center on snapped edge after resize
    if (_snapConfig?.snappedEdge) {
      const monitor = await currentMonitor();
      if (!monitor) return;
      const size = await appWindow.outerSize();
      let x: number, y: number;
      const edge = _snapConfig.snappedEdge;
      const padding = _snapConfig.edgePadding * monitor.scaleFactor;
      switch (edge) {
        case "top":
          x = monitor.position.x + Math.round((monitor.size.width - size.width) / 2);
          y = monitor.position.y + padding;
          break;
        case "bottom":
          x = monitor.position.x + Math.round((monitor.size.width - size.width) / 2);
          y = monitor.position.y + monitor.size.height - size.height - padding;
          break;
        case "left":
          x = monitor.position.x + padding;
          y = monitor.position.y + Math.round((monitor.size.height - size.height) / 2);
          break;
        case "right":
          x = monitor.position.x + monitor.size.width - size.width - padding;
          y = monitor.position.y + Math.round((monitor.size.height - size.height) / 2);
          break;
        default:
          return;
      }
      await appWindow.setPosition(new PhysicalPosition(x, y));
      await invoke("save_position", { x, y });
    }
  });
}
```

- [ ] **Step 2: Set `_snapConfig` in `init()` after loading config**

In `init()`, after `let config = await invoke<Config>("get_config");`, add:

```typescript
  _snapConfig = config.snap;
```

And in the `config-changed` listener, add:

```typescript
  _snapConfig = event.payload.snap;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: re-center window on snapped edge after resize"
```

---

### Task 5: Add preferences UI for edge snapping

**Files:**
- Modify: `src/preferences-page.ts`

- [ ] **Step 1: Update `renderBehaviorPage` to include snap controls**

Replace the `renderBehaviorPage` function:

```typescript
function renderBehaviorPage(config: Config): string {
  return `
    <div class="prefs-page" data-page="behavior">
      <div class="prefs-page-title">Behavior</div>

      <div class="prefs-section">
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Always on Top</span>
            <span class="prefs-row-hint">Keep the monitor window above other windows</span>
          </div>
          ${toggleSwitch("pref-always-on-top", config.alwaysOnTop)}
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Edge Snapping</span>
            <span class="prefs-row-hint">Snap window to screen edges when dragged nearby</span>
          </div>
          ${toggleSwitch("pref-snap-enabled", config.snap.enabled)}
        </div>

        <div class="prefs-row" id="pref-snap-padding-row" style="display: ${config.snap.enabled ? "flex" : "none"}">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Edge Padding</span>
            <span class="prefs-row-hint">Gap between window and screen edge</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-snap-padding" min="0" max="32" value="${config.snap.edgePadding}">
            <span class="prefs-range-value" id="pref-snap-padding-val">${config.snap.edgePadding}px</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Bind the snap controls in `init()`**

In the `init()` function, after the existing `bindCheckbox("#pref-always-on-top", ...)` block, add:

```typescript
  bindCheckbox("#pref-snap-enabled", (v) => {
    config.snap.enabled = v;
    const paddingRow = document.getElementById("pref-snap-padding-row");
    if (paddingRow) paddingRow.style.display = v ? "flex" : "none";
    if (!v) config.snap.snappedEdge = null;
    save();
  });

  const snapPaddingEl = document.querySelector<HTMLInputElement>("#pref-snap-padding");
  if (snapPaddingEl) {
    const snapPaddingVal = document.getElementById("pref-snap-padding-val");
    snapPaddingEl.addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (snapPaddingVal) snapPaddingVal.textContent = v + "px";
      config.snap.edgePadding = v;
      save();
    });
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: add edge snapping toggle and padding slider to preferences"
```

---

### Task 6: Manual testing and final commit

- [ ] **Step 1: Build the app**

Run: `npm run tauri dev`
Expected: App launches without errors.

- [ ] **Step 2: Test snapping disabled (default)**

1. Open Preferences > Behavior
2. Verify "Edge Snapping" toggle is OFF by default
3. Verify "Edge Padding" slider is hidden
4. Drag the window around — it should behave exactly as before (free positioning)

- [ ] **Step 3: Test snapping enabled**

1. Enable "Edge Snapping" toggle
2. Verify "Edge Padding" slider appears with value "4px"
3. Drag the window to the bottom of the screen — it should snap centered along the bottom edge
4. Drag to the left edge — it should snap centered along the left edge and orientation should switch to vertical
5. Drag to the top edge — it should snap centered along the top and switch back to horizontal
6. Drag to the right edge — it should snap centered along the right edge and switch to vertical
7. Drag away from all edges — it should stay where dropped (free position)

- [ ] **Step 4: Test padding**

1. Adjust the Edge Padding slider to 16px
2. Snap to an edge — verify the gap between window and edge is visibly larger
3. Set padding to 0 — verify window sits flush against the edge

- [ ] **Step 5: Test re-centering on resize**

1. Snap to the bottom edge
2. Have an agent session start or end (changing mascot count)
3. Verify the window re-centers on the bottom edge after resizing

- [ ] **Step 6: Test persistence**

1. Snap to an edge, then quit the app
2. Relaunch — verify window restores to the snapped position

- [ ] **Step 7: Test backward compatibility**

1. Delete `snap` key from `~/.spacebar/config.json`
2. Relaunch — verify app starts normally with snap disabled (defaults applied)
