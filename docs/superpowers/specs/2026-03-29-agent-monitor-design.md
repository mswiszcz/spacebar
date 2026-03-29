# Agent Monitor — Design Spec

A macOS dock-like floating bar that shows animated mascots representing running AI agents. Agents connect via CLI hooks, and each mascot visually reflects the agent's current state through CSS/SVG animations. Clicking a mascot focuses its terminal window.

## Architecture

Three layers:

### 1. Tauri App (Rust Backend)

- Manages state: a `HashMap<String, Session>` of active agent sessions
- Runs a lightweight HTTP server on a local port (binds to `127.0.0.1:0` to let the OS assign an available port)
- Writes the active port to `~/.agentmonitor.port` on startup, removes it on shutdown
- Pushes state changes to the webview frontend via Tauri events
- Handles click actions: receives a Tauri command from the frontend, spawns the registered shell command for that session

### 2. Webview Frontend (HTML/CSS/SVG)

- Renders the bar: a frameless, transparent, draggable window
- Renders mascots using inline SVG with CSS animations
- Listens for Tauri events (`session-added`, `session-updated`, `session-removed`) to manage the mascot grid
- Handles click on mascot: invokes a Tauri command that runs the session's `onClick` shell command
- Manages entry/exit animations (CSS transforms)
- Renders the preferences popover

### 3. CLI Sidecar (`agentmonitor`)

- A thin Rust binary bundled with the Tauri app as a sidecar
- Reads the port from `~/.agentmonitor.port`
- Sends JSON HTTP requests to the app's local server
- Designed to be called from agent hook configurations (e.g., Claude Code `settings.json` hooks)

## CLI Protocol

### Endpoints

| Method | Path        | Body                                    | Description                        |
|--------|-------------|-----------------------------------------|------------------------------------|
| POST   | `/register` | `{ agent, sessionId, onClick }`         | Add a mascot to the bar            |
| POST   | `/update`   | `{ sessionId, state }`                  | Change mascot animation state      |
| POST   | `/remove`   | `{ sessionId }`                         | Remove mascot (triggers exit anim) |
| GET    | `/health`   | —                                       | Check if app is running            |

### CLI Commands

```bash
# Register a new agent session
agentmonitor register --agent claude-code --session-id <id> --on-click "<command>"

# Update an agent's state
agentmonitor update --session-id <id> --state <state>

# Remove an agent session
agentmonitor remove --session-id <id>

# Check if the app is running
agentmonitor health
```

### Session Data Model

```rust
struct Session {
    session_id: String,
    agent: String,        // e.g. "claude-code" — determines mascot type
    state: String,        // current animation state
    on_click: String,     // shell command to run on mascot click
    registered_at: u64,   // unix timestamp
}
```

### Hook Integration (Claude Code)

Each Claude Code hook maps to a CLI command:

| Hook                          | CLI Command                                                              |
|-------------------------------|--------------------------------------------------------------------------|
| `SessionStart`                | `agentmonitor register --agent claude-code --session-id $SESSION_ID --on-click "..."` |
| `UserPromptSubmit`            | `agentmonitor update --session-id $SESSION_ID --state thinking`          |
| `Stop`                        | `agentmonitor update --session-id $SESSION_ID --state idle`              |
| `PreToolUse (AskUserQuestion)`| `agentmonitor update --session-id $SESSION_ID --state needs-input`       |
| `PermissionRequest`           | `agentmonitor update --session-id $SESSION_ID --state needs-input`       |
| `SubagentStart`               | `agentmonitor register --agent claude-code --session-id $SUBAGENT_SESSION_ID --on-click "..."` |
| `PostToolUseFailure (Bash)`   | `agentmonitor update --session-id $SESSION_ID --state error`             |
| `PreCompact`                  | `agentmonitor update --session-id $SESSION_ID --state compacting`        |
| `Notification`                | `agentmonitor update --session-id $SESSION_ID --state notification`      |
| `SessionEnd`                  | `agentmonitor remove --session-id $SESSION_ID`                           |

## Mascot System

### Structure

```
src/mascots/
  claude-code.ts    // SVG + CSS for Claude Code mascot
  index.ts          // Registry: agent name -> mascot module
```

### Mascot Module Interface

Each mascot file exports:

```typescript
interface MascotDefinition {
  // Returns SVG markup for the given state
  svg(state: string): string;
  // CSS keyframe animations and state-specific styles
  css: string;
  // Metadata
  metadata: {
    name: string;
    defaultColor: string;
    size: { width: number; height: number };
  };
}
```

### Adding a New Agent Mascot

1. Create a new `.ts` file in `src/mascots/` implementing `MascotDefinition`
2. Register it in `src/mascots/index.ts` with its agent name key
3. Use the agent name in CLI calls: `agentmonitor register --agent <name> ...`

### Animation States

| State          | Visual Description                        | CSS Animation                           |
|----------------|-------------------------------------------|-----------------------------------------|
| `idle`         | Relaxed face, gentle breathing            | Subtle scale pulse on body              |
| `thinking`     | Focused eyes, thinking dots above head    | Head wobble + animated dot bubble       |
| `needs-input`  | Wide eyes, open mouth                     | Bouncing + pulsing question indicator   |
| `error`        | X eyes, frown                             | Shake/tremble + red tint                |
| `compacting`   | Squished/sweating face                    | Squeeze animation + sweat drops         |
| `notification` | Waving hand/arm                           | Wave animation + small bell icon        |
| `entering`     | Full mascot, arrival                      | Drop from above with bounce easing      |
| `exiting`      | Full mascot, departure                    | Slide down + fade out                   |

### State Transitions

When the state changes, the mascot cross-fades between SVG variants over ~200ms. Entry and exit are special: they use CSS transforms (`translateY`) with easing curves and last ~400ms.

## Sound Effects

Each state transition can trigger a short sound effect. One built-in preset for v1. Sounds are tied to the animation trigger — when a mascot changes state, the corresponding sound plays.

### Sound Mapping

| State          | Sound                          |
|----------------|--------------------------------|
| `entering`     | Soft pop/chime                 |
| `exiting`      | Gentle swoosh                  |
| `thinking`     | Subtle tick                    |
| `needs-input`  | Attention ping                 |
| `error`        | Low buzz                       |
| `compacting`   | Squeeze/compress               |
| `notification` | Bell ding                      |
| `idle`         | (silent)                       |

### Settings

- `sound.enabled` — master toggle (default: `true`)
- `sound.volume` — 0.0 – 1.0 (default: `0.5`)

Sounds are short audio files (`.wav` or `.ogg`) bundled with the app in a `sounds/` resource directory.

## App Window

### Window Properties

- Frameless Tauri window with transparent background
- macOS native vibrancy (`NSVisualEffectView`) for glass/blur effect
- Draggable from any point on the bar background
- Remembers position across restarts
- Auto-resizes as mascots are added/removed (grows in the direction of orientation)

### Display Modes

- **Horizontal:** Mascots arranged in a row, bar grows wider
- **Vertical:** Mascots arranged in a column, bar grows taller

### Mascot Info Display (User-Configurable)

Three levels, all toggleable independently:

- **Mascot only:** Animation state tells the story
- **Labels:** Short status text below/beside each mascot
- **Tooltips:** Hover shows a detail card (session name, uptime, current state)

## User Settings

Stored in `~/.agentmonitor/config.json`. All settings apply immediately at runtime.

```json
{
  "orientation": "horizontal",
  "alwaysOnTop": true,
  "mascotSize": "medium",
  "showLabels": true,
  "showTooltips": true,
  "position": { "x": 100, "y": 100 },
  "sound": {
    "enabled": true,
    "volume": 0.5
  },
  "theme": {
    "backgroundColor": "#1a1a2e",
    "backgroundOpacity": 0.8,
    "blurRadius": 20,
    "borderRadius": 12,
    "borderColor": "#ffffff10",
    "accentColor": "#E8825A"
  }
}
```

### Settings Definitions

| Setting              | Type     | Values                                  | Default        |
|----------------------|----------|-----------------------------------------|----------------|
| `orientation`        | string   | `"horizontal"`, `"vertical"`            | `"horizontal"` |
| `alwaysOnTop`        | boolean  | —                                       | `true`         |
| `mascotSize`         | string   | `"small"` (32px), `"medium"` (48px), `"large"` (64px) | `"medium"` |
| `showLabels`         | boolean  | —                                       | `true`         |
| `showTooltips`       | boolean  | —                                       | `true`         |
| `position`           | object   | `{ x: number, y: number }`             | `{ x: 100, y: 100 }` |
| `theme.backgroundColor`  | string | CSS color                              | `"#1a1a2e"`    |
| `theme.backgroundOpacity` | number | 0.0 – 1.0                             | `0.8`          |
| `theme.blurRadius`   | number   | 0 – 50 (px)                            | `20`           |
| `theme.borderRadius` | number   | 0 – 30 (px)                            | `12`           |
| `theme.borderColor`  | string   | CSS color                               | `"#ffffff10"`  |
| `theme.accentColor`  | string   | CSS color                               | `"#E8825A"`    |

## Preferences UI

- Accessed via right-click on the bar background
- Opens as a popover attached to the bar (not a separate window)
- Changes apply immediately with live preview
- Persists to `~/.agentmonitor/config.json` on every change

### Sections

1. **Layout** — Orientation toggle (H/V), mascot size slider, show labels toggle, show tooltips toggle
2. **Appearance** — Background color picker, opacity slider, blur radius slider, border radius slider, border color picker, accent color picker
3. **Sound** — Enable/disable toggle, volume slider
4. **Behavior** — Always-on-top toggle

## Technology Stack

| Component       | Technology                     |
|-----------------|--------------------------------|
| App framework   | Tauri v2                       |
| Backend         | Rust                           |
| Frontend        | HTML + CSS + TypeScript        |
| Animations      | CSS keyframes + inline SVG     |
| HTTP server     | Rust (axum or actix-web lite)  |
| CLI sidecar     | Rust binary (Tauri sidecar)    |
| Glass effect    | macOS NSVisualEffectView       |
| Config storage  | JSON file (`~/.agentmonitor/`) |
| Port discovery  | Lockfile (`~/.agentmonitor.port`) |

## Scope Boundaries

**In scope for v1:**
- Single agent mascot type (Claude Code)
- All 8 animation states
- Horizontal and vertical orientations
- Glass effect with full theme customization
- Live preferences popover
- CLI sidecar with register/update/remove/health
- Click-to-focus via user-provided command
- Sound effects on state transitions (one preset, volume control)
- macOS only

**Out of scope for v1:**
- Multiple mascot types beyond Claude Code
- System tray integration
- Auto-update mechanism
- Windows/Linux support
- Session persistence across app restarts
