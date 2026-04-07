# Docker Container Registration

**Date:** 2026-04-07
**Status:** Draft

## Problem

Claude Code instances spawned inside Docker containers (e.g., n8n workflows) cannot register with Spacebar because:

1. The container can't read `~/.spacebar.port` from the host filesystem
2. The container's `127.0.0.1` is its own loopback, not the host's
3. Spacebar's HTTP server binds to `127.0.0.1`, rejecting non-loopback connections

## Solution

Three changes that maintain full backward compatibility.

### 1. Server: stable port with configurable bind address (`server.rs`, `config.rs`)

**Port:** On first launch, Spacebar picks a random available port and persists it to config (`~/.spacebar/config.json` field `port`). On subsequent launches, it reuses that port. The user can change it in config at any time.

**Bind address:** New config field `bind` in `~/.spacebar/config.json`. Default: `"127.0.0.1"`. Set to `"0.0.0.0"` to accept connections from Docker containers.

The port file (`~/.spacebar.port`) is still written for backward compatibility with existing CLI installations.

### 2. CLI: configurable host (`cli/src/main.rs`)

`SPACEBAR_HOST` env var — full `host:port` to connect to. When set, the CLI skips reading `~/.spacebar.port` and connects directly to `http://$SPACEBAR_HOST`. Auto-launch logic is also skipped (the container can't launch macOS apps).

When `SPACEBAR_HOST` is not set, behavior is identical to today.

### 3. Config changes (`config.rs`)

Add two fields to `Config`:

```rust
#[serde(default = "default_bind")]
pub bind: String,        // default: "127.0.0.1"

#[serde(default)]
pub port: Option<u16>,   // None = first run, will be randomized and saved
```

**First-run flow:**
1. `port` is `None` in config
2. Server binds to `bind:0` (random port)
3. Server writes the assigned port back to config
4. All subsequent launches use that port

**Port conflict handling:** If the persisted port is unavailable, log a warning and fall back to a random port, then update config with the new port.

## Usage

### Host setup

1. Launch Spacebar normally — it auto-picks and persists a port on first run
2. To enable Docker access, set `bind` to `"0.0.0.0"` in `~/.spacebar/config.json`:

```json
{
  "bind": "0.0.0.0",
  "port": 52718
}
```

### Docker Compose

```yaml
services:
  n8n:
    environment:
      - SPACEBAR_HOST=host.docker.internal:52718
```

Where `52718` is whatever port Spacebar persisted in config (check `~/.spacebar/config.json`).

The `spacebar` CLI binary must be available inside the container (mounted or installed). Claude Code hooks call it as usual — the only difference is the env var telling it where to connect.

## Scope

### In scope

- `config.rs`: add `bind` and `port` fields to `Config` with defaults
- `server.rs`: read bind/port from config, persist port on first run, handle port conflicts
- `cli/src/main.rs`: read `SPACEBAR_HOST` env var, use as direct base URL, skip port file + auto-launch when set

### Out of scope

- Authentication/tokens (local network only, acceptable risk)
- Different mascot for Docker sessions
- Auto-launch from containers
- CLI binary distribution/packaging for Docker images

## Changes summary

| File | Change |
|---|---|
| `src-tauri/src/config.rs` | Add `bind: String` and `port: Option<u16>` fields to `Config` |
| `src-tauri/src/server.rs` | Use config bind/port, persist port on first run, fallback on conflict |
| `cli/src/main.rs` | Read `SPACEBAR_HOST`, use as direct base URL when set, skip port file + auto-launch |
