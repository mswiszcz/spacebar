# Icon Display Mode

**Date:** 2026-04-07
**Status:** Draft

## Overview

Add an alternative display mode for agent sessions: instead of the full animated mascot, users can choose a simple branded icon per agent type with a status dot indicator. The preference is per-agent-type (e.g., mascot for Claude, icon for Codex).

## Motivation

The full mascot with animations is expressive but not everyone wants it. Some users prefer a minimal, information-dense display — a recognizable agent icon with a small colored dot for state.

## Config Changes

### Backend (`config.rs`)

Two new fields on `Config`:

```rust
display_modes: HashMap<String, String>,  // agent_type → "mascot" | "icon"
status_dot_corner: String,               // "top-left" | "top-right" | "bottom-left" | "bottom-right"
```

- `display_modes`: defaults to empty map. Missing agent types default to `"mascot"`.
- `status_dot_corner`: defaults to `"top-left"`. Global setting — applies to all icons.

Both fields use `#[serde(default)]` for backward compatibility with existing config files.

## MascotDefinition Changes

### `types.ts`

Add an optional `icon` field to `MascotDefinition`:

```typescript
interface MascotDefinition {
  // existing fields (body, css, etc.)
  icon?: {
    svg: string;  // branded SVG markup, uses currentColor for theming
  };
}
```

Agents without an `icon` field cannot be switched to icon mode — the preferences UI won't offer "Icon" for them.

## Icon Definitions

### Initial set

- `claude-code`: Anthropic logo SVG (stylized "A" mark), monochrome with `currentColor`
- Fallback/unknown: generic terminal icon SVG

### Requirements

- Monochrome, uses `currentColor` to inherit accent color from theme
- Square viewBox, legible at 24-48px
- New agents are added as files in `src/mascots/` with at minimum the `icon` field

## Icon Sizing

Icon mode uses smaller sizes than mascot mode at each tier:

| Tier   | Mascot | Icon |
|--------|--------|------|
| Small  | 32px   | 24px |
| Medium | 48px   | 36px |
| Large  | 64px   | 48px |

## Status Dot

A small circle (6px at medium size, scales proportionally) positioned at a user-chosen corner of the icon container.

### Visibility by state

| State        | Dot visible | Color     | Dot animation               |
|-------------|-------------|-----------|------------------------------|
| Idle         | No          | —         | —                            |
| Thinking     | Yes         | `#facc15` | Pulse (opacity 0.6↔1, 1.5s) |
| Needs-input  | Yes         | `#60a5fa` | Pulse (opacity 0.6↔1, 1s)   |
| Error        | Yes         | `#ef4444` | None                         |
| Compacting   | Yes         | `#facc15` | Pulse (opacity 0.6↔1, 1.5s) |
| Notification | Yes         | `#60a5fa` | Pulse (opacity 0.6↔1, 1s)   |
| Sleeping     | No          | —         | —                            |
| Entering     | No          | —         | —                            |
| Exiting      | No          | —         | —                            |

### Corner placement

CSS classes `dot-top-left`, `dot-top-right`, `dot-bottom-left`, `dot-bottom-right` control position. Applied based on `status_dot_corner` config value.

## Icon Animations

Subtle animations on the icon itself (not the dot):

| State        | Icon animation                              |
|-------------|---------------------------------------------|
| Thinking     | Opacity pulse (0.7 → 1.0, 2s cycle)        |
| Compacting   | Opacity pulse (0.7 → 1.0, 2s cycle)        |
| Needs-input  | Scale pulse (1.0 → 1.05, 1s cycle)         |
| Notification | Scale pulse (1.0 → 1.05, 1s cycle)         |
| Sleeping     | Static, opacity 0.5                          |
| All others   | Static                                       |

No shake animation for any state.

## Rendering Pipeline

### `mascot-grid.ts`

When rendering a session, check `config.display_modes[session.agent_type]`:

- **`"mascot"` or missing:** Current behavior — render full SVG from `MascotDefinition.body()`, apply CSS animation classes per state.
- **`"icon"`:** Render icon SVG from `MascotDefinition.icon.svg`, wrap in container with status dot `<div>`, apply simpler animation set.

Both modes use the same `mascot-item` container. Click handlers, hover/tooltip, and sleep timers work identically. The only difference is what goes inside the SVG wrapper.

### Sleep transition

Same 30s idle→sleeping timer. In icon mode, sleeping dims icon opacity to 0.5, hides dot.

## Styles

### New CSS

- `.icon-wrapper`: container for icon SVG, sized per icon tier
- `.status-dot`: absolutely positioned circle, hidden by default
- `.dot-top-left`, `.dot-top-right`, `.dot-bottom-left`, `.dot-bottom-right`: corner positions
- `.dot-thinking`, `.dot-needs-input`, `.dot-error`, `.dot-compacting`, `.dot-notification`: color and animation per state
- `.icon-thinking`, `.icon-compacting`: opacity pulse animation
- `.icon-needs-input`, `.icon-notification`: scale pulse animation
- `.icon-sleeping`: opacity 0.5

## Preferences UI

### Layout tab additions

1. **Display Mode** — per-agent-type selector. Shows each agent type from currently active sessions, with a dropdown: Mascot / Icon. Only agents with an `icon` defined in their `MascotDefinition` show the "Icon" option. Default: Mascot.

2. **Status Dot Corner** — dropdown: Top-Left / Top-Right / Bottom-Left / Bottom-Right. Only visible when at least one agent type is set to Icon mode. Default: Top-Left.

Both emit `config-changed` and persist to `config.json`.

## Unchanged Systems

- **Sound:** Triggers on state transitions regardless of display mode.
- **Tooltip:** Shows session ID, agent type, state, uptime. Same hover target.
- **Click:** Calls `execute_click` the same way.
- **Groups:** Icon-mode sessions render in groups identically.
- **Split view:** Icon-mode sessions participate in split view the same way.

## Scope

- Extend `MascotDefinition` with optional `icon` field
- Add `display_modes` and `status_dot_corner` to config
- Branch rendering in `mascot-grid.ts`
- Add icon CSS classes to `styles.css`
- Add two controls to Layout tab in `preferences-page.ts`
- Create Anthropic logo icon SVG for `claude-code`
- Create fallback terminal icon SVG
