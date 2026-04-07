# GitHub Actions Release Workflow

## Overview

Automate the Spacebar release process via a GitHub Actions workflow triggered manually with a version number. The workflow bumps version strings, commits, tags, builds, packages, and publishes a GitHub release.

## Trigger

`workflow_dispatch` with a required `version` input (e.g. `0.7.0`, no `v` prefix).

Local invocation via CLI:

```bash
gh workflow run release.yml -f version=0.7.0
```

Optionally watch progress:

```bash
gh run watch
```

## Workflow Steps

### 1. Validate input

- Ensure `version` matches semver pattern (`X.Y.Z`)
- Fail early if not

### 2. Checkout and bump versions

Checkout `main`. Patch the version string in all 5 files:

1. `package.json` — `"version": "X.Y.Z"`
2. `src-tauri/Cargo.toml` — `version = "X.Y.Z"` (under `[package]`)
3. `cli/Cargo.toml` — `version = "X.Y.Z"` (under `[package]`)
4. `src-tauri/tauri.conf.json` — `"version": "X.Y.Z"`
5. `install.sh` — `VERSION="${SPACEBAR_VERSION:-X.Y.Z}"`

Use `sed` for replacements. Then run `cargo update --workspace` to sync `Cargo.lock`.

### 3. Commit and tag

- Commit all changed files with message: `chore: bump version to X.Y.Z`
- Create tag `vX.Y.Z` on that commit
- Push commit and tag to `origin main`

### 4. Build

- Run `npm ci` to install frontend dependencies
- Run `npm run tauri build` to build the Tauri app bundle (includes frontend build via `beforeBuildCommand`)
- Run `cargo build --release -p spacebar` to build the CLI binary

### 5. Package tarball

Create `Spacebar_aarch64.tar.gz` containing:
- `Spacebar.app` (from `target/release/bundle/macos/`)
- `spacebar` CLI binary (from `target/release/`)

Use a temp directory approach (macOS `tar` lacks `--transform`):
1. Create temp dir
2. Copy `Spacebar.app` and `spacebar` binary into it
3. `tar -czf Spacebar_aarch64.tar.gz -C $TMPDIR Spacebar.app spacebar`

### 6. Create GitHub release

Generate release notes from commits between the previous tag and `vX.Y.Z`. Use `gh release create` with `--generate-notes` flag to auto-generate notes from commit history.

Upload `Spacebar_aarch64.tar.gz` as a release asset.

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --generate-notes \
  Spacebar_aarch64.tar.gz
```

## Runner

`macos-latest` (ARM64/aarch64). Single architecture only.

## Permissions

- `contents: write` — for pushing commits, tags, and creating releases

## Changes to /release skill

The `/release` skill is simplified to:

1. Show commits since last tag (`git log --oneline $(git describe --tags --abbrev=0)..HEAD`)
2. Determine semver bump level and new version
3. Ask user to confirm
4. Run `gh workflow run release.yml -f version=X.Y.Z`
5. Run `gh run watch` to follow progress
6. Show release URL when complete

## Files changed

- **New:** `.github/workflows/release.yml`
- **Modified:** `/release` skill (simplified to dispatch workflow)
