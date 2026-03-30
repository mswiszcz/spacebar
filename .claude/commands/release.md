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

## Step 2: Bump version

Update the version string in ALL 5 of these files — no exceptions:
1. `package.json` — the `"version"` field
2. `src-tauri/Cargo.toml` — the `version` field under `[package]`
3. `cli/Cargo.toml` — the `version` field under `[package]`
4. `src-tauri/tauri.conf.json` — the `"version"` field
5. `install.sh` — the default value in `VERSION="${SPACEBAR_VERSION:-X.Y.Z}"`

Then run `cargo update --workspace` to update Cargo.lock.

## Step 3: Commit, tag, and push

Stage all changed files (the 5 version files + Cargo.lock). Do NOT stage unrelated files.

Commit with message: `chore: bump version to X.Y.Z`

Create a git tag: `git tag vX.Y.Z`

Push to origin with tags: `git push origin main --tags`

## Step 4: Build release artifacts

Run the full build:
```
npm run tauri build
```
This builds the frontend, the Tauri app bundle, and produces `Spacebar.app`.

Then build the CLI separately:
```
cargo build --release -p spacebar
```

## Step 5: Package tarball

Detect the current architecture:
- `arm64` → `aarch64`
- `x86_64` → `x86_64`

Create the tarball in the project root:
```
tar -czf Spacebar_${ARCH_SUFFIX}.tar.gz -C target/release/bundle/macos Spacebar.app -C ../../.. target/release/spacebar --transform='s|target/release/||'
```

If the tar `--transform` flag isn't available (macOS), use a temp directory approach:
1. Create a temp dir
2. Copy `target/release/bundle/macos/Spacebar.app` into it
3. Copy `target/release/spacebar` into it
4. tar from the temp dir
5. Move tarball to project root

## Step 6: Create GitHub release

Generate release notes from the commits since the last tag. Group by type:
- **Features** — `feat:` commits
- **Fixes** — `fix:` commits
- **Other** — everything else (only include if non-trivial)

Create the release and upload the tarball:
```
gh release create vX.Y.Z --title "vX.Y.Z" --notes "<generated notes>" Spacebar_${ARCH_SUFFIX}.tar.gz
```

## Step 7: Confirm

Show the user the release URL and confirm everything completed successfully.
