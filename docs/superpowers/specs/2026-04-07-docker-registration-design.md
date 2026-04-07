# Docker Container Registration

**Date:** 2026-04-07
**Status:** Draft

## Problem

Claude Code instances spawned inside Docker containers (e.g., n8n workflows) cannot register with Spacebar because:

1. The container can't read `~/.spacebar.port` from the host filesystem
2. The container's `127.0.0.1` is its own loopback, not the host's
3. Spacebar's HTTP server binds to `127.0.0.1`, rejecting non-loopback connections

## Solution

Two environment-variable-driven changes that maintain full backward compatibility.

### 1. Server: configurable bind address and port (`server.rs`)

- `SPACEBAR_BIND` — IP address to bind to. Default: `127.0.0.1`. Set to `0.0.0.0` to accept connections from Docker containers.
- `SPACEBAR_PORT` — Fixed port number. Default: `0` (random). Set to a fixed value (e.g., `9876`) so Docker Compose can hardcode it.

The port file (`~/.spacebar.port`) is still written regardless, so local CLI usage is unaffected.

### 2. CLI: configurable host (`cli/src/main.rs`)

- `SPACEBAR_HOST` — Full `host:port` to connect to. When set, the CLI skips reading `~/.spacebar.port` and connects directly to `http://$SPACEBAR_HOST`. Auto-launch logic is also skipped (the container can't launch macOS apps).

When `SPACEBAR_HOST` is not set, behavior is identical to today.

## Usage

### Host setup

Launch Spacebar with:

```bash
SPACEBAR_BIND=0.0.0.0 SPACEBAR_PORT=9876 open -a Spacebar
```

Or persist in Spacebar config so it applies automatically on launch.

### Docker Compose

```yaml
services:
  n8n:
    environment:
      - SPACEBAR_HOST=host.docker.internal:9876
```

The `spacebar` CLI binary must be available inside the container (mounted or installed). Claude Code hooks call it as usual — the only difference is the env var telling it where to connect.

## Scope

### In scope

- `server.rs`: read `SPACEBAR_BIND` and `SPACEBAR_PORT` env vars, use them in `TcpListener::bind`
- `cli/src/main.rs`: read `SPACEBAR_HOST` env var, use it as base URL, skip port file and auto-launch when set
- Config persistence: add `bind` and `port` fields to `~/.spacebar/config.json` as fallbacks when env vars are not set. Env vars take precedence over config values.

### Out of scope

- Authentication/tokens (local network only, acceptable risk)
- Different mascot for Docker sessions
- Auto-launch from containers
- CLI binary distribution/packaging for Docker images

## Changes summary

| File | Change |
|---|---|
| `src-tauri/src/server.rs` | Read `SPACEBAR_BIND` and `SPACEBAR_PORT`, pass to `TcpListener::bind` |
| `cli/src/main.rs` | Read `SPACEBAR_HOST`, use as direct base URL when set, skip port file + auto-launch |
