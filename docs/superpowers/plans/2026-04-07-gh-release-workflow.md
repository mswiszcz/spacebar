# GitHub Actions Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the Spacebar build/release process via a GitHub Actions workflow triggered manually with a version number.

**Architecture:** A single `workflow_dispatch` workflow that accepts a version string, bumps all version files via `sed`, commits, tags, builds the Tauri app + CLI, packages a tarball, and creates a GitHub release. The `/release` skill is simplified to assess changes, suggest a version, and dispatch the workflow via `gh`.

**Tech Stack:** GitHub Actions, macOS runner (`macos-latest`), Rust/Cargo, Node/npm, Tauri CLI, `gh` CLI

---

### Task 1: Create the release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version number (e.g. 0.7.0)'
        required: true
        type: string

permissions:
  contents: write

jobs:
  release:
    runs-on: macos-latest
    steps:
      - name: Validate version format
        run: |
          if [[ ! "${{ inputs.version }}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "::error::Invalid version format '${{ inputs.version }}'. Expected X.Y.Z"
            exit 1
          fi

      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: Swatinem/rust-cache@v2

      - name: Install frontend dependencies
        run: npm ci

      - name: Bump versions
        run: |
          VERSION="${{ inputs.version }}"

          # package.json
          sed -i '' "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"${VERSION}\"/" package.json

          # src-tauri/Cargo.toml (only the [package] version, first occurrence)
          sed -i '' "0,/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/s//version = \"${VERSION}\"/" src-tauri/Cargo.toml

          # cli/Cargo.toml (only the [package] version, first occurrence)
          sed -i '' "0,/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/s//version = \"${VERSION}\"/" cli/Cargo.toml

          # src-tauri/tauri.conf.json
          sed -i '' "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json

          # install.sh
          sed -i '' "s/SPACEBAR_VERSION:-[0-9]*\.[0-9]*\.[0-9]*/SPACEBAR_VERSION:-${VERSION}/" install.sh

          # Update Cargo.lock
          cargo update --workspace

      - name: Commit and tag
        run: |
          VERSION="${{ inputs.version }}"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json src-tauri/Cargo.toml cli/Cargo.toml src-tauri/tauri.conf.json install.sh Cargo.lock
          git commit -m "chore: bump version to ${VERSION}"
          git tag "v${VERSION}"
          git push origin main --tags

      - name: Build Tauri app
        run: npm run tauri build

      - name: Build CLI
        run: cargo build --release -p spacebar

      - name: Package tarball
        run: |
          TMPDIR="$(mktemp -d)"
          cp -R target/release/bundle/macos/Spacebar.app "$TMPDIR/"
          cp target/release/spacebar "$TMPDIR/"
          tar -czf Spacebar_aarch64.tar.gz -C "$TMPDIR" Spacebar.app spacebar
          rm -rf "$TMPDIR"

      - name: Create GitHub release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "v${{ inputs.version }}" \
            --title "v${{ inputs.version }}" \
            --generate-notes \
            Spacebar_aarch64.tar.gz
```

- [ ] **Step 2: Verify the file is valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add GitHub Actions release workflow"
```

---

### Task 2: Simplify the /release skill

**Files:**
- Modify: `.claude/commands/release.md`

- [ ] **Step 1: Replace the release skill contents**

Replace the entire contents of `.claude/commands/release.md` with:

```markdown
Prepare and publish a new release of Spacebar.

## Step 1: Assess changes

Run `git log --oneline $(git describe --tags --abbrev=0)..HEAD` to see all commits since the last release tag.

Determine the appropriate version bump based on conventional commit messages:
- **major**: any commit contains a breaking change (BREAKING CHANGE in body, or `!` after type)
- **minor**: any `feat:` commits
- **patch**: only `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `perf:`, `test:` commits

Read the current version from `package.json`. Calculate the new version. Show the user:
- The commits being included
- The determined bump level and new version number

Ask the user to confirm before proceeding.

## Step 2: Dispatch the release workflow

Run the GitHub Actions release workflow:

```
gh workflow run release.yml -f version=X.Y.Z
```

Then watch the run:

```
gh run watch
```

## Step 3: Confirm

Once the run completes, get the release URL:

```
gh release view vX.Y.Z --json url -q .url
```

Show the user the release URL and confirm everything completed successfully.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/release.md
git commit -m "feat: simplify /release skill to dispatch GH Actions workflow"
```
