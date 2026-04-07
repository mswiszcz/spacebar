# Spacebar

A macOS menu bar app that shows animated mascots representing your running AI agents. Each mascot visually reflects what the agent is doing — thinking, waiting for input, hitting an error — so you always know the state of your agents at a glance.

Built with [Tauri v2](https://v2.tauri.app), Rust, and TypeScript.

## Features

- **Animated mascots** — Each agent gets a character with state-driven CSS/SVG animations (idle, thinking, needs input, error, compacting, notification)
- **Dock-like bar** — Horizontal or vertical floating bar, draggable anywhere on screen (Option+click mascots to drag)
- **Click to focus** — Click a mascot to jump to that agent's terminal window
- **Glass effect** — Native macOS vibrancy with configurable blur, opacity, and colors
- **Sound effects** — Audio cues on state transitions (toggleable, adjustable volume)
- **Live preferences** — Right-click to open preferences; changes apply immediately
- **System tray** — Lives in the menu bar, hidden from Dock
- **CLI integration** — Any agent can connect via simple CLI commands

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/mswiszcz/spacebar/main/install.sh | bash
```

This installs `Spacebar.app` to `/Applications` and the `spacebar` CLI to `/usr/local/bin`.

To install a specific version:

```bash
SPACEBAR_VERSION=0.5.0 curl -fsSL https://raw.githubusercontent.com/mswiszcz/spacebar/main/install.sh | bash
```

## Building from Source

### Prerequisites

- macOS 13+
- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) 18+
- npm

## Setup

```bash
# Clone the repo
git clone <repo-url> spacebar
cd spacebar

# Install frontend dependencies
npm install

# Build the CLI
cd cli && cargo build --release && cd ..
```

## Development

```bash
# Run in dev mode (hot reload)
npm run tauri dev
```

## Build for Production

```bash
# Build the app bundle
npm run tauri build
```

The `.app` bundle will be in `src-tauri/target/release/bundle/macos/`.

The CLI binary will be at `cli/target/release/spacebar`.

## CLI Usage

The `spacebar` CLI communicates with the running app via a local HTTP API. The app writes its port to `~/.spacebar.port` on startup.

```bash
# Register a new agent session (mascot appears with entrance animation)
spacebar register \
  --agent claude-code \
  --session-id "my-session-123" \
  --on-click "wsh view focus"

# Update agent state (mascot animation changes)
spacebar update --session-id "my-session-123" --state thinking

# Remove agent session (mascot exits with slide-down animation)
spacebar remove --session-id "my-session-123"

# Check if the app is running
spacebar health
```

### Available States

| State | Animation |
|-------|-----------|
| `idle` | Gentle breathing, relaxed face |
| `thinking` | Head wobble, thinking dots |
| `needs-input` | Bouncing, question mark pulse |
| `error` | Shake/tremble, red tint |
| `compacting` | Squeeze animation, sweat drops |
| `notification` | Waving arm, bell icon |

## Claude Code Hooks Setup

Add these hooks to your `~/.claude/settings.json` to connect Claude Code to Spacebar. Replace `<PATH>` with the absolute path to the `spacebar` binary and `<FOCUS_CMD>` with your terminal's focus command.

**Terminal focus commands by app:**
- **WaveTerm:** `wsh view focus`
- **iTerm2:** `osascript -e 'tell application "iTerm2" to activate'`
- **Terminal.app:** `osascript -e 'tell application "Terminal" to activate'`
- **Kitty:** `kitty @ focus-window`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar register --agent claude-code --session-id $SESSION_ID --on-click \"<FOCUS_CMD>\""
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar remove --session-id $SESSION_ID"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state thinking"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state idle"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state needs-input"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state needs-input"
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar register --agent claude-code --session-id $SUBAGENT_SESSION_ID --on-click \"<FOCUS_CMD>\""
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state error"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state compacting"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "<PATH>/spacebar update --session-id $SESSION_ID --state notification"
          }
        ]
      }
    ]
  }
}
```

## Docker / Remote Containers

You can connect Claude Code instances running inside Docker containers (e.g., n8n workflows) to a Spacebar instance on the host machine.

### 1. Configure Spacebar for Docker access

Open Spacebar preferences (Behavior tab → Server section) and set:
- **Bind Address** to `0.0.0.0 (all interfaces)`
- **Port** is auto-assigned on first launch — note the value

Or edit `~/.spacebar/config.json` directly:

```json
{
  "bind": "0.0.0.0",
  "port": 52718
}
```

Restart Spacebar after changing these settings.

### 2. Build the CLI for Linux

The container needs a Linux build of the `spacebar` CLI:

```bash
cd cli
cross build --release --target x86_64-unknown-linux-gnu
```

### 3. Configure Docker Compose

Mount the CLI binary and set the `SPACEBAR_HOST` environment variable:

```yaml
services:
  your-service:
    environment:
      - SPACEBAR_HOST=host.docker.internal:52718
    volumes:
      - ./cli/target/x86_64-unknown-linux-gnu/release/spacebar:/usr/local/bin/spacebar:ro
```

Replace `52718` with your actual port from step 1.

### 4. Set up Claude Code hooks inside the container

The container's Claude Code needs the same hooks as a local installation (see [Claude Code Hooks Setup](#claude-code-hooks-setup) above). If you mount a shared `~/.claude/settings.json` into the container, the hooks are already in place.

When `SPACEBAR_HOST` is set, the CLI connects directly to that address, skipping port file discovery and auto-launch (which don't work inside containers).

## Preferences

Right-click the bar to open the preferences window.

| Section | Controls |
|---------|----------|
| **Layout** | Orientation (H/V), mascot size (S/M/L), show labels, show tooltips |
| **Appearance** | Background color, opacity, blur radius, corner radius, border color, accent color |
| **Sound** | Enable/disable, volume |
| **Behavior** | Always on top |

Settings are stored in `~/.spacebar/config.json` and apply immediately.

## Adding New Agent Types

The mascot system is designed to be extended. To add a new agent mascot:

1. Create `src/mascots/your-agent.ts` implementing the `MascotDefinition` interface
2. Export SVG markup for each state and CSS animation keyframes
3. Register it in `src/mascots/registry.ts`
4. Use the agent name in CLI calls: `spacebar register --agent your-agent ...`

See `src/mascots/claude-code.ts` for a complete example.

## Project Structure

```
spacebar/
├── src/                    # Frontend (TypeScript)
│   ├── main.ts             # Entry point, Tauri event listeners
│   ├── state.ts            # Session state store
│   ├── mascot-grid.ts      # Mascot rendering and animations
│   ├── sound.ts            # Sound playback
│   ├── tooltip.ts          # Hover tooltips
│   ├── preferences.ts      # Preferences window launcher
│   └── mascots/            # Mascot definitions
│       ├── types.ts         # MascotDefinition interface
│       ├── claude-code.ts   # Claude Code mascot SVG + CSS
│       └── registry.ts     # Agent name → mascot lookup
├── src-tauri/              # Backend (Rust)
│   └── src/
│       ├── lib.rs          # Tauri setup, tray, vibrancy
│       ├── server.rs       # HTTP API server
│       ├── state.rs        # Session store
│       ├── config.rs       # Config load/save
│       └── commands.rs     # Tauri commands
├── cli/                    # CLI sidecar (Rust)
│   └── src/main.rs         # register/update/remove/health
└── public/sounds/          # Sound effect assets
```

## Releasing

Releases are automated via GitHub Actions. To create a new release:

```bash
# Assess changes and determine version
git log --oneline $(git describe --tags --abbrev=0)..HEAD

# Trigger the release workflow
gh workflow run release.yml -f version=X.Y.Z

# Watch progress
gh run watch
```

The workflow bumps version strings across the project, commits, tags, builds the Tauri app and CLI, packages a tarball, and publishes a GitHub release.

Or use the `/release` command in Claude Code, which automates the version assessment and dispatch.

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork and clone** the repository
2. **Create a branch** for your feature or fix: `git checkout -b feat/my-feature`
3. **Make your changes** — follow existing code style and patterns
4. **Test your changes** — run `cargo test --workspace` and `npx tsc --noEmit`
5. **Commit** with a clear message describing what and why
6. **Open a pull request** with a description of your changes

### Guidelines

- **Keep it focused** — One feature or fix per PR. Don't bundle unrelated changes.
- **Follow existing patterns** — Match the code style, file organization, and naming conventions already in the project.
- **Test what you build** — Add tests for new Rust code. Verify the app runs and behaves correctly.
- **New mascots welcome** — Adding mascots for other agents (Cursor, Codex, etc.) is a great way to contribute. Follow the pattern in `src/mascots/claude-code.ts`.
- **No breaking changes** — The CLI interface and HTTP API are public contracts. Don't change them without discussion.
- **macOS first** — This is a macOS app. Cross-platform support may come later, but don't add platform abstractions prematurely.

### What We're Looking For

- New agent mascot types with expressive animations
- Better SVG art for the Claude Code mascot
- Sound design improvements
- Bug fixes
- Documentation improvements

## License

[Apache License 2.0](LICENSE) — free to use, modify, and distribute under the terms of the Apache License 2.0.
