# Spacebar Companion App — Design Spec

## Overview

A React Native companion app for Android and iOS that connects to the Spacebar desktop app over the local network via WebSocket, providing real-time monitoring and control of AI agent sessions from a mobile device.

## Goals

- Mirror all agent session states in real-time on the phone
- Allow tapping a mascot to focus its terminal window on the desktop
- Zero infrastructure — local network only, no cloud, no accounts
- One-time QR code pairing for secure connection

## Non-Goals (Out of Scope)

- Cloud relay / remote access outside LAN
- Push notifications
- Editing preferences from the companion
- Removing sessions from the companion
- Multiple desktop instance support

---

## Monorepo Structure

```
spacebar/
├── apps/
│   ├── desktop/              # Current Spacebar app (moved here)
│   │   ├── src/              # TypeScript frontend
│   │   ├── src-tauri/        # Rust backend
│   │   ├── cli/              # CLI binary
│   │   └── ...
│   └── companion/            # React Native app (Expo)
│       ├── src/
│       ├── android/
│       ├── ios/
│       └── package.json
├── packages/
│   └── shared/               # Shared types & constants
│       ├── src/
│       │   └── types.ts
│       └── package.json
├── package.json              # Workspace root
├── Cargo.toml                # Rust workspace (paths updated)
└── README.md
```

---

## Shared Package (`@spacebar/shared`)

Extracted TypeScript types used by both apps:

```typescript
type AgentState = "idle" | "thinking" | "needs-input" | "error" | "compacting" | "notification"

interface Session {
  sessionId: string
  agent: string
  state: AgentState
  onClick?: string
  pwd?: string
  groupId?: string
}

interface Group {
  groupId: string
  displayName: string
  sessions: string[]
}

// WebSocket protocol
type ServerMessage =
  | { type: "snapshot"; sessions: Session[]; groups: Group[] }
  | { type: "session-added"; session: Session }
  | { type: "session-updated"; session: Session }
  | { type: "session-removed"; sessionId: string }
  | { type: "group-added"; group: Group }
  | { type: "group-updated"; group: Group }
  | { type: "group-removed"; groupId: string }

type ClientMessage =
  | { type: "focus"; sessionId: string }
```

The desktop app also imports from `@spacebar/shared`, replacing its local type definitions.

---

## Desktop Changes

### WebSocket Endpoint (`/ws`)

Added to the existing Axum HTTP server:

- On client connect: send a `snapshot` message with all current sessions and groups
- On every state change (session/group add/update/remove): broadcast the corresponding event to all connected WebSocket clients
- These are the same events already emitted via Tauri's `emit()` — just also pushed to WebSocket clients
- Accept `ClientMessage` from clients: `{ type: "focus", sessionId }` triggers the existing `execute_click` logic

### Network Exposure + Security

- Bind the Axum server to `0.0.0.0` instead of `127.0.0.1` so LAN devices can reach it
- Generate a random auth token on startup
- Store token alongside port (new `~/.spacebar.auth` file or extend `~/.spacebar.port`)
- WebSocket handshake requires token as query param: `/ws?token=xxx`
- Invalid/expired token closes the WebSocket with code 4001

### mDNS Discovery

- Advertise `_spacebar._tcp` on the local network using an mDNS crate (e.g., `mdns-sd`)
- Service record includes the port number
- Token is exchanged separately via QR pairing (not in the mDNS record)
- Re-advertises on app restart

---

## Pairing Flow

1. **Desktop:** New "Companion" tab in Preferences window. "Pair Device" button generates and displays a QR code containing:
   ```json
   {
     "token": "random-auth-token",
     "port": 12345
   }
   ```

2. **Companion:** Opens camera, scans QR, extracts token. Discovers Spacebar via mDNS (`_spacebar._tcp`), connects WebSocket with token. If snapshot is received — pairing complete. Token saved to AsyncStorage.

3. **Re-pairing:** "Reset token" in desktop preferences invalidates the old token. Companion connection fails with 4001, prompts user to scan again.

No accounts. No cloud. Just scan and connect.

---

## Companion App (React Native / Expo)

### Tech Stack

- React Native with Expo (managed workflow)
- TypeScript
- Imports `@spacebar/shared` from the monorepo

### Screens

**1. Pairing Screen**
- Shown on first launch or when re-pairing is needed
- Opens camera to scan QR code from desktop Preferences
- Stores token + port in AsyncStorage

**2. Main Screen**
- Vertical scrollable list of session cards, grouped by working directory
- Each card shows:
  - Mascot SVG (rendered via `react-native-svg`)
  - Agent name
  - Current state with color indicator (idle=green, thinking=blue, needs-input=orange, error=red, compacting=purple, notification=yellow)
  - Mascot animations ported from CSS to React Native Animated/Reanimated
- Tap a card → sends `{ type: "focus", sessionId }` over WebSocket → desktop focuses that terminal

**3. Connection Status**
- Persistent indicator at top: connected / disconnected / reconnecting
- Auto-reconnects with exponential backoff

### State Management

- React context + `useReducer`
- Same event-driven pattern as desktop's `SessionState` pub/sub
- No persistent storage of session data (ephemeral, like desktop)
- Only pairing token and connection preferences are persisted

### WebSocket Lifecycle

- Connects on app foreground, disconnects on background (battery saving)
- On connect: receives full `snapshot`, renders everything
- After connect: incremental updates applied to local state
- On disconnect: shows status, retries with exponential backoff

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Multiple phones connected | Supported — server broadcasts to all WebSocket clients |
| Desktop app restarts | Port/token may change. mDNS re-advertises. Companion detects disconnect, rediscovers via mDNS, reconnects with stored token. If token changed, prompts re-pair |
| Phone switches WiFi | WebSocket drops, companion retries, reconnects when back on same network |
| Large number of sessions | Not a concern — even 100 sessions is a tiny JSON payload |
| Desktop quits | WebSocket drops, companion shows "disconnected", keeps retrying |

---

## Summary of Changes

| Component | Change |
|---|---|
| Repo structure | Monorepo with `apps/desktop`, `apps/companion`, `packages/shared` |
| Desktop Axum server | Add WebSocket endpoint, bind to `0.0.0.0`, auth token, mDNS |
| Desktop Preferences | New "Companion" tab with QR code pairing |
| Shared package | Extract `Session`, `Group`, `AgentState` types + WebSocket protocol |
| Companion app | New React Native (Expo) app with pairing, real-time monitoring, tap-to-focus |
