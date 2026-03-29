# Agent Monitor — Feature Roadmap Spec

Seven features to evolve Agent Monitor from a single-agent visualizer into a multi-agent monitoring platform for AI coding tools. Prioritized for developer adoption and multi-session awareness.

## 1. Urgent State Escalation

### Problem
Agents enter `needs-input` or `error` states and sit idle while the user is focused elsewhere. The current visual change is too subtle to notice peripherally.

### Requirements
- Progressive escalation with three tiers, each triggered after a configurable delay:
  1. **Visual** (immediate): intensified glow/pulse animation on the mascot
  2. **Bounce** (default: 15s): mascot physically bounces in the bar to catch peripheral vision
  3. **System notification** (default: 60s): macOS native notification with agent label and state
- Escalation applies to `needs-input` and `error` states only
- Each tier's delay is configurable per-state in preferences (Behavior tab)
- A new "Notifications" section in preferences: enable/disable each tier, adjust thresholds
- Clicking the mascot or focusing the agent's terminal resets escalation for that session
- Sound escalation: optional volume ramp tied to escalation tier (e.g., first play at configured volume, second play at 1.5x, third at 2x, capped at 1.0)

### Data Model Changes
```typescript
// Config additions
interface EscalationConfig {
  enabled: boolean;              // master toggle, default: true
  tiers: {
    visual: { delayMs: number }; // default: 0
    bounce: { delayMs: number }; // default: 15000
    notify: { delayMs: number }; // default: 60000
  };
  soundRamp: boolean;            // default: false
  states: string[];              // which states trigger escalation, default: ["needs-input", "error"]
}
```

### Implementation Notes
- Frontend manages escalation timers per session (start on state change, clear on click/focus/state-change-away)
- macOS notifications via Tauri notification plugin (`@tauri-apps/plugin-notification`)
- Notification click should invoke the session's `on_click` command

---

## 2. Agent Activity Timeline

### Problem
With multiple concurrent agents, there's no way to see what happened across sessions without hovering each mascot individually. State transitions are ephemeral — once a state changes, the previous state is lost.

### Requirements
- A collapsible timeline panel accessible from the main bar (toggle button or keyboard shortcut)
- Shows a reverse-chronological feed of state transitions across all agents
- Each entry shows: timestamp, agent label/session ID, previous state → new state, with mascot color indicator
- Filterable by: agent type, session, state type
- Maximum 200 entries retained in memory (oldest pruned)
- Timeline persists across the current app session but clears on restart (unless session persistence is also implemented)
- Optional: compact mode (one-line per event) vs. detailed mode (includes duration in previous state)

### Data Model Changes
```typescript
interface TimelineEvent {
  timestamp: number;          // unix ms
  sessionId: string;
  agent: string;
  previousState: string;
  newState: string;
  label?: string;             // human-readable session label if set
}
```

### UI
- Panel slides out from the bottom or side of the main bar (configurable)
- Lightweight, doesn't obscure the mascot grid
- Each event row is clickable → focuses that agent's terminal
- Real-time: new events appear as they happen with a subtle animation

### Implementation Notes
- Backend emits timeline events alongside existing `session-updated` events
- Frontend maintains the timeline array and renders it
- Stored in-memory only (no disk persistence unless combined with feature #9)

---

## 4. Multi-Agent Dashboard Mode

### Problem
The dock bar is great for 1-3 agents but becomes hard to scan with 4+ concurrent sessions. Tooltips require hovering each mascot individually.

### Requirements
- A toggleable "dashboard" view that replaces the compact bar with an expanded card layout
- Toggle via: keyboard shortcut, tray menu item, or a button on the bar itself
- Each agent gets a card showing:
  - Mascot (current animated state)
  - Session label (or session ID first 8 chars)
  - Agent type
  - Current state (text + color indicator)
  - Uptime
  - Time in current state
- Cards arranged in a responsive grid (2-3 columns depending on window size)
- Dashboard window is resizable (unlike the bar)
- Clicking a card focuses the agent's terminal (same as clicking a mascot)
- The bar and dashboard are mutually exclusive — switching to dashboard hides the bar, and vice versa
- Dashboard inherits the same glass/vibrancy effect as the bar

### UI Layout
```
┌─────────────────────────────────────────────┐
│  Agent Monitor — Dashboard          [─] [×] │
├─────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐          │
│ │  [mascot]    │  │  [mascot]    │          │
│ │  auth-refac  │  │  fix-tests   │          │
│ │  thinking    │  │  needs-input │          │
│ │  ⏱ 12m       │  │  ⏱ 3m        │          │
│ └──────────────┘  └──────────────┘          │
│ ┌──────────────┐  ┌──────────────┐          │
│ │  [mascot]    │  │  [mascot]    │          │
│ │  api-work    │  │  docs-gen    │          │
│ │  idle        │  │  compacting  │          │
│ │  ⏱ 45m       │  │  ⏱ 1m        │          │
│ └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────┤
│  [Timeline]  (if feature #2 is present)     │
└─────────────────────────────────────────────┘
```

### Implementation Notes
- Reuse existing mascot rendering from `mascot-grid.ts`
- Dashboard is the same Tauri window resized and reflowed, or a separate window
- Preference to remember last-used mode (bar vs. dashboard)

---

## 5. New Mascot: Generic Agent

### Problem
Only Claude Code has a mascot. Registering a non-Claude agent (Cursor, Aider, etc.) would either show nothing or fall back awkwardly. The app doesn't feel multi-agent-ready.

### Requirements
- A new mascot design: a friendly generic "robot" or "terminal" character
- Follows the same `MascotDefinition` interface: SVG markup per state, CSS animations
- All 9 states implemented with distinct visual treatments
- Automatically assigned when `agent` type doesn't match any registered mascot
- Visual identity: neutral color (e.g., `#7B8DAA` — cool gray-blue), distinct silhouette from Claude Code
- Character concept: a rounded monitor/screen face with expressive eyes (not anthropomorphic like Claude Code's body)
- Same size constraints as Claude Code (66x52 viewBox, scalable)

### Design Direction
- **Idle**: neutral face, blinking
- **Thinking**: processing dots or spinning indicator on screen
- **Needs-input**: question mark on screen, wide eyes
- **Error**: X on screen, red tint
- **Compacting**: compression lines
- **Notification**: bell icon overlay
- **Entering/Exiting**: fade in/out with screen flicker
- **Sleeping**: screen dimmed, z's

### Implementation Notes
- Create `src/mascots/generic-agent.ts`
- Register as the default fallback in `src/mascots/registry.ts`
- The registry lookup should: exact match first → fallback to generic

---

## 7. Agent Registration SDK / Protocol

### Problem
Currently agents can only register via the CLI binary, which requires shell hooks. Not all tools support hooks, and the setup friction is high for non-Claude agents.

### Requirements
- A documented HTTP protocol spec (the existing `/register`, `/update`, `/remove`, `/health` endpoints formalized)
- An **npm package** (`@agent-monitor/sdk`) for JavaScript/TypeScript agents:
  ```typescript
  import { AgentMonitor } from '@agent-monitor/sdk';

  const monitor = new AgentMonitor();
  await monitor.register({ agent: 'my-tool', label: 'task-name', onClick: 'open -a Terminal' });
  await monitor.update({ state: 'thinking' });
  await monitor.remove();
  ```
- A **Python package** (`agent-monitor`) for Python-based agents:
  ```python
  from agent_monitor import AgentMonitor

  monitor = AgentMonitor()
  monitor.register(agent="my-tool", label="task-name", on_click="open -a Terminal")
  monitor.update(state="thinking")
  monitor.remove()
  ```
- Both SDKs:
  - Auto-discover port from `~/.agentmonitor.port`
  - Handle connection failures gracefully (agent shouldn't crash if monitor isn't running)
  - Auto-generate session IDs if not provided
  - Expose a context manager / disposable pattern for automatic cleanup
- An "Integration Guide" page in docs explaining how to connect any agent
- Protocol additions to support new features:
  - `label` field on `/register` (for session grouping, feature #3 potential)
  - `metadata` optional field for arbitrary key-value pairs

### Protocol Spec (formalized)
```
POST /register
Content-Type: application/json
{
  "agent": string,        // required — agent type identifier
  "sessionId": string,    // required — unique session ID
  "onClick": string,      // required — shell command on click
  "label": string,        // optional — human-readable name
  "metadata": object      // optional — arbitrary key-value pairs
}

POST /update
Content-Type: application/json
{
  "sessionId": string,    // required
  "state": string         // required — one of the valid states
}

POST /remove
Content-Type: application/json
{
  "sessionId": string     // required
}

GET /health
Response: { "status": "ok", "sessions": number, "uptime": number }
```

### Implementation Notes
- SDKs are separate packages in a `packages/` directory (monorepo approach) or separate repos
- The protocol is the contract — SDKs are convenience wrappers
- Prioritize npm SDK first (most AI coding tools are Node-based)

---

## 8. Keyboard Shortcuts & Global Hotkeys

### Problem
Managing multiple agents with only mouse interactions is slow. Power users need keyboard-driven navigation.

### Requirements
- **Global hotkey** to show/hide the monitor (default: `Cmd+Shift+A`), configurable in preferences
- **In-app shortcuts** when the monitor window is focused:
  - `←` / `→` (or `↑` / `↓` in vertical mode): navigate between mascots
  - `Enter`: focus the selected mascot's terminal (execute `on_click`)
  - `D`: toggle dashboard mode (if feature #4 is present)
  - `T`: toggle timeline panel (if feature #2 is present)
  - `Esc`: hide the monitor
- **Jump to urgent**: a global hotkey (default: `Cmd+Shift+U`) that focuses the agent most recently entering `needs-input` or `error`
- Visual selection indicator: subtle highlight ring around the currently keyboard-selected mascot
- All shortcuts listed in preferences (Behavior tab) and customizable
- Shortcuts work in both bar mode and dashboard mode

### Implementation Notes
- Global hotkeys via Tauri's `globalShortcut` plugin
- In-app keyboard events handled in frontend
- Selection state managed in frontend (index into ordered session list)
- Customizable shortcuts stored in config

---

## 9. Session Persistence & History

### Problem
Sessions are lost on app restart. No way to review what agents ran, how long they took, or what happened in past sessions.

### Requirements
- **Persistence**: active sessions survive app restarts
  - On shutdown: serialize current sessions to `~/.agentmonitor/sessions.json`
  - On startup: restore sessions, mark them as `sleeping` (since the agents may or may not still be running)
  - A restored session that receives an `/update` resumes normally
  - A restored session that hasn't received any update within 5 minutes gets auto-removed (configurable)
- **History**: keep a log of completed (removed) sessions
  - Stored in `~/.agentmonitor/history.json`
  - Each entry: session ID, agent type, label, registered time, removed time, total duration, state transition count
  - Retain last 7 days or 500 entries (whichever is smaller), configurable
  - Viewable in a "History" tab in preferences or in the dashboard
- **History UI**: simple table/list showing recent sessions with duration and outcome
  - Sortable by date, duration, agent type
  - Searchable/filterable

### Data Model
```typescript
interface HistoryEntry {
  sessionId: string;
  agent: string;
  label?: string;
  registeredAt: number;     // unix ms
  removedAt: number;        // unix ms
  duration: number;         // ms
  stateTransitions: number;
  finalState: string;       // state when removed
}
```

### Implementation Notes
- Rust backend handles serialization/deserialization on startup/shutdown
- Tauri `on_exit` hook for graceful shutdown persistence
- History file rotation: prune on startup if exceeding limits
- Consider SQLite if history needs grow beyond simple JSON (future)

---

## Feature Dependencies

```
┌─────────────────────┐
│ 5. Generic Mascot   │  ← Independent, enables multi-agent visuals
└─────────────────────┘

┌─────────────────────┐
│ 7. SDK / Protocol   │  ← Independent, enables non-CLI registration
└─────────────────────┘

┌─────────────────────┐     ┌──────────────────────┐
│ 9. Persistence      │────→│ 2. Timeline (enhanced)│
└─────────────────────┘     └──────────────────────┘

┌─────────────────────┐
│ 1. Escalation       │  ← Independent, core awareness improvement
└─────────────────────┘

┌─────────────────────┐
│ 8. Keyboard Shortcuts│ ← Independent, but enhanced by #4
└─────────────────────┘

┌─────────────────────┐     ┌──────────────────────┐
│ 2. Timeline         │────→│ 4. Dashboard (embeds) │
└─────────────────────┘     └──────────────────────┘
```

### Suggested Implementation Order
1. **Generic Mascot** (#5) — small, self-contained, makes the app feel multi-agent immediately
2. **SDK / Protocol** (#7) — enables the ecosystem, parallel with other work
3. **Urgent State Escalation** (#1) — highest-impact awareness feature
4. **Keyboard Shortcuts** (#8) — quick win for power users
5. **Session Persistence & History** (#9) — foundation for timeline
6. **Agent Activity Timeline** (#2) — builds on persistence
7. **Multi-Agent Dashboard** (#4) — capstone feature, benefits from all others
