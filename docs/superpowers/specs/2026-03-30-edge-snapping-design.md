# Edge Snapping Design

## Summary

Add a preference to snap the Spacebar window to any screen edge (top, bottom, left, right), similar to macOS Dock positioning. When enabled, dragging the window near a screen edge snaps it centered along that edge with configurable padding. Orientation auto-switches to match the edge axis.

## Config Changes

### Rust (`config.rs`)

New `SnapConfig` struct added to `Config`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapConfig {
    pub enabled: bool,
    pub edge_padding: u32,
    pub snapped_edge: Option<String>, // "top", "bottom", "left", "right", or null
}
```

- `#[serde(default)]` on the `snap` field in `Config` for backward compatibility
- Default: `{ enabled: false, edge_padding: 4, snapped_edge: None }`

### TypeScript (`Config` interface)

```typescript
snap: { enabled: boolean; edgePadding: number; snappedEdge: string | null };
```

The existing `position: { x, y }` field continues to store the actual window coordinates.

## Snap Logic (Frontend — `main.ts`)

All snapping logic lives in TypeScript, triggered by the existing `tauri://move` event listener.

### Detection

The `tauri://move` event fires continuously during drag. To avoid fighting the user mid-drag, snap detection uses a debounce: only evaluate snap after the window position has been stable for ~150ms (indicating drag ended). On each move event:

1. Get the window's outer position and size
2. Get the current monitor bounds via `currentMonitor()`
3. Check if the window is within ~50px of any screen edge:
   - **Bottom:** `windowY + windowHeight > monitorBottom - threshold`
   - **Top:** `windowY < monitorTop + threshold`
   - **Left:** `windowX < monitorLeft + threshold`
   - **Right:** `windowX + windowWidth > monitorRight - threshold`
4. If multiple edges match, pick the closest one

### Snap Positioning

When a snap triggers:

1. Calculate the centered position along the target edge, offset by `edgePadding` pixels from the edge
2. Call `appWindow.setPosition()` to move the window
3. Save `snappedEdge` to config

When the window is not near any edge, it stays where dropped and `snappedEdge` is set to `null`.

### Orientation Auto-Switch

When snapping occurs:

- Snap to **top or bottom** → set orientation to `"horizontal"`
- Snap to **left or right** → set orientation to `"vertical"`

The orientation change is saved to config and triggers `applyConfig()` for immediate layout update.

### Re-centering on Resize

When the window resizes (mascots added/removed, size change via `resizeWindow()`), if `snappedEdge` is set, re-center the window along that edge. This ensures adding or removing mascots keeps the window properly centered on its snapped edge.

### Startup

Window restores to the last saved `position: { x, y }` as usual. If `snappedEdge` is set, the position already reflects the snapped coordinates from the last session.

## Preferences UI (`preferences-page.ts`)

Two new rows in the **Behavior** tab:

### Edge Snapping Toggle

- Label: "Edge Snapping"
- Hint: "Snap window to screen edges when dragged nearby"
- Control: Toggle switch (same pattern as "Always on Top")
- Bound to `config.snap.enabled`

### Edge Padding Slider

- Label: "Edge Padding"
- Hint: "Gap between window and screen edge"
- Control: Range slider, 0–32px, displays current value in px
- Default: 4px
- Visibility: Only shown when Edge Snapping is enabled
- Bound to `config.snap.edgePadding`

## Behavior Summary

| State | Behavior |
|---|---|
| Snapping disabled (default) | Current behavior — drag anywhere, position saved as raw coordinates |
| Snapping enabled, drag near edge | Window snaps centered on closest edge, orientation auto-switches, position saved |
| Snapping enabled, drag away from edges | Window stays where dropped, `snappedEdge` cleared |
| Window resize while snapped | Re-centers on the snapped edge |
| Startup | Restores last saved position regardless of snap state |

## Files to Modify

| File | Changes |
|---|---|
| `src-tauri/src/config.rs` | Add `SnapConfig` struct, add `snap` field to `Config` with default |
| `src/main.ts` | Add snap detection/positioning in `tauri://move` listener, re-center logic in `resizeWindow()` |
| `src/preferences-page.ts` | Add snap toggle and padding slider to Behavior tab, update `Config` interface |
