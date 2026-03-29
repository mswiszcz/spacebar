# Tooltip Window Design

Render session tooltips in a separate Tauri window so they can appear outside the main window's small viewport, with smart edge-aware positioning.

## Goals

- Tooltip is never clipped by the main window boundaries
- Smart positioning: above by default, flips/shifts when near screen edges
- Scales to growing tooltip content without layout constraints
- Styles use CSS variables, ready for a future theme system

## Out of Scope

- Theme picker / theme CSS file system (follow-up)
- Changes to existing manual appearance controls
- Tooltip content changes (same rows as today: session ID, agent, state, uptime)

## Architecture

### Tooltip Window

A second Tauri webview window created once at app startup in `lib.rs`:

- **Borderless, transparent, no decorations** — visually a tooltip, not a window
- **Non-focusable** — never steals focus from the main window
- **Skip taskbar** — does not appear in app switcher or Dock
- **Always on top** — matches the main window's always-on-top setting
- **Click-through** (`ignore_cursor_events: true`) — mouse events pass through to underlying windows
- **Initially hidden** — shown on hover, hidden on mouse leave

The window loads `tooltip.html`, a minimal page containing a tooltip renderer script (`tooltip-window.ts`).

### Files

| File | Role |
|------|------|
| `tooltip.html` | HTML shell for the tooltip window |
| `src/tooltip-window.ts` | Listens for Tauri events, renders tooltip content, reports size |
| `src/tooltip.ts` | Refactored: coordinates tooltip show/hide/position from the main window |
| `src-tauri/src/lib.rs` | Creates the tooltip window alongside the main window |
| `src/styles.css` | Tooltip styles updated to use CSS variables for theme-readiness |

## Communication Flow

### Show Tooltip (mascot hover)

1. `mascot-grid.ts` calls `showTooltip(session, anchorElement)` (existing API, unchanged)
2. `tooltip.ts` computes the mascot's screen-space anchor position:
   - Gets main window position via `getCurrentWindow().outerPosition()`
   - Adds mascot's local position via `anchor.getBoundingClientRect()`
   - Produces `anchorScreenX` (center of mascot) and `anchorScreenY` (top of mascot)
3. `tooltip.ts` emits Tauri event `tooltip:show` with payload:
   ```typescript
   {
     sessionId: string,
     agent: string,
     state: string,
     registeredAt: number,
     anchorScreenX: number,
     anchorScreenY: number
   }
   ```
4. `tooltip-window.ts` receives the event, renders content into the DOM, measures the rendered size
5. `tooltip-window.ts` emits `tooltip:ready` with payload:
   ```typescript
   { width: number, height: number }
   ```
6. `tooltip.ts` receives the size, runs edge-detection (see below), then calls Tauri commands to position, resize, and show the tooltip window

### Hide Tooltip (mouse leave)

1. `mascot-grid.ts` calls `hideTooltip()` (existing API, unchanged)
2. `tooltip.ts` emits `tooltip:hide`
3. `tooltip-window.ts` hides the tooltip content
4. `tooltip.ts` hides the tooltip window via Tauri API

## Smart Positioning

Default placement: centered horizontally above the mascot, 8px gap.

Edge detection algorithm:

```
screen = currentMonitor().size + currentMonitor().position
tooltipW, tooltipH = from tooltip:ready event

// Default: above, centered
x = anchorScreenX - tooltipW / 2
y = anchorScreenY - tooltipH - 8

// Flip to below if not enough space above
if y < screen.top:
  y = anchorScreenY + mascotHeight + 8

// Shift horizontally if overflowing
if x < screen.left:
  x = screen.left + 4
if x + tooltipW > screen.right:
  x = screen.right - tooltipW - 4

// Clamp bottom edge
if y + tooltipH > screen.bottom:
  y = screen.bottom - tooltipH - 4
```

The mascot height is passed alongside the anchor coordinates so the "flip below" case knows where to position.

## Tooltip Window Rendering

`tooltip-window.ts` responsibilities:

- Listen for `tooltip:show` — render session rows, measure content, emit `tooltip:ready`
- Listen for `tooltip:hide` — clear content
- Compute uptime from `registeredAt` (same logic as current `showTooltip`)

HTML structure (same as current):

```html
<div class="tooltip">
  <div class="tooltip-row"><span class="tooltip-label">Session</span> ...</div>
  <div class="tooltip-row"><span class="tooltip-label">Agent</span> ...</div>
  <div class="tooltip-row"><span class="tooltip-label">State</span> ...</div>
  <div class="tooltip-row"><span class="tooltip-label">Uptime</span> ...</div>
</div>
```

## Theme-Readiness

All tooltip visual properties use CSS variables:

```css
.tooltip {
  background: var(--tooltip-bg, rgba(20, 20, 40, 0.95));
  border: 1px solid var(--tooltip-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--tooltip-radius, 8px);
  color: var(--tooltip-text, #ddd);
  font-size: var(--tooltip-font-size, 11px);
  backdrop-filter: blur(var(--tooltip-blur, 10px));
}

.tooltip-label {
  color: var(--tooltip-label-color, #888);
}
```

For now, defaults match the current hardcoded values. When the theme system is built, themes set these variables alongside the main window variables.

The tooltip window's HTML loads the same CSS file, so variables set on `:root` apply to both windows when the theme system provides them.

## Tauri Commands

No new Rust commands needed. The main window's `tooltip.ts` uses Tauri's `WebviewWindow` API to get a handle to the tooltip window by label (`"tooltip"`) and calls `.setPosition()`, `.setSize()`, `.show()`, `.hide()` directly from the frontend. This keeps all tooltip logic in TypeScript and avoids adding Rust surface area.

## Window Configuration

In `tauri.conf.json`, add a second window entry:

```json
{
  "label": "tooltip",
  "url": "tooltip.html",
  "title": "",
  "width": 200,
  "height": 100,
  "visible": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false,
  "shadow": false,
  "focus": false
}
```

`ignore_cursor_events` is set programmatically in `lib.rs` after window creation since it is not available in the JSON config.

## Migration

- The existing `tooltip.ts` is refactored in place — its public API (`initTooltip`, `showTooltip`, `hideTooltip`) stays the same
- `mascot-grid.ts` requires no changes
- The `.tooltip` CSS class in `styles.css` is updated to use CSS variables but retains the same defaults
- The tooltip DOM element currently appended to the main window's body is removed
