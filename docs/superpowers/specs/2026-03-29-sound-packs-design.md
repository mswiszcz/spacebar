# Sound Packs for Agent Monitor

## Overview

Add a sound pack system that lets users choose a themed set of sounds for mascot state transitions, with the ability to override individual sounds using their own audio files.

## Business Requirements

- Users can select from 3 built-in sound packs (Default, Retro, Mechanical)
- Each pack provides all 7 state sounds (entering, exiting, thinking, needs-input, error, compacting, notification)
- Users can override any individual sound with a custom audio file via native file picker
- Users can preview/audition any sound (pack or custom) from the preferences UI
- Overrides can be reset to revert to the active pack's default

## Config Schema

`SoundConfig` in `src-tauri/src/config.rs` expands:

```rust
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f64,
    pub pack: String,                          // "default", "retro", "mechanical"
    pub overrides: HashMap<String, String>,     // state name → absolute file path
}
```

- `pack` defaults to `"default"`
- `overrides` defaults to empty map
- Override keys: `"entering"`, `"exiting"`, `"thinking"`, `"needs-input"`, `"error"`, `"compacting"`, `"notification"`

## File Structure

Reorganize `public/sounds/` from flat files to pack subdirectories:

```
public/sounds/
├── default/
│   ├── enter.wav
│   ├── exit.wav
│   ├── tick.wav
│   ├── ping.wav
│   ├── buzz.wav
│   ├── squeeze.wav
│   └── bell.wav
├── retro/
│   └── (same 7 files, 8-bit themed)
└── mechanical/
    └── (same 7 files, mechanical themed)
```

Existing WAV files move into `default/`.

## Pack Registry

Pack metadata lives in TypeScript (no JSON manifests):

```typescript
const PACKS: Record<string, { name: string; description: string }> = {
  default: { name: "Default", description: "Clean, minimal sounds" },
  retro: { name: "Retro", description: "8-bit arcade style" },
  mechanical: { name: "Mechanical", description: "Typewriter and gears" },
};
```

## Sound Resolution

`sound.ts` resolves sounds in this order:

1. Check `overrides[state]` — if present, use `convertFileSrc(path)` to create a playable URL from the absolute file path
2. Fall back to `/sounds/{activePack}/{file}.wav`

Audio cache keys change from filename to resolved URL. Cache is cleared when the user switches packs or changes an override.

## Preferences UI

The Sound section in `preferences-page.ts` expands:

1. **Existing controls:** Enable toggle, volume slider (unchanged)
2. **New pack dropdown:** Selects the active pack
3. **Sound slots list:** One row per state, each with:
   - State label (e.g., "Thinking")
   - Source indicator ("Default" or "Custom: filename.wav")
   - Play/preview button
   - File picker button (opens native dialog)
   - Reset button (visible only when overridden, clears the override)

Preferences window height increases from 480px to ~600px.

## New Tauri Command

`pick_sound_file` — opens a native file dialog filtered to `.wav`, `.mp3`, `.ogg` and returns the selected file path (or null if cancelled). Uses `tauri-plugin-dialog`.

## Asset Protocol

Override files live outside the app bundle, so the Tauri asset protocol scope must allow reading arbitrary file paths. `convertFileSrc()` from `@tauri-apps/api/core` converts an absolute path to an `asset://` URL the webview can load. The asset scope in `tauri.conf.json` needs to permit this.

## Files to Modify

### Rust (Backend)
- `src-tauri/src/config.rs` — Expand `SoundConfig` with `pack` and `overrides` fields
- `src-tauri/src/commands.rs` — Add `pick_sound_file` command
- `src-tauri/src/lib.rs` — Register new command, add dialog plugin
- `src-tauri/Cargo.toml` — Add `tauri-plugin-dialog` dependency

### TypeScript (Frontend)
- `src/sound.ts` — Pack-aware resolution, override support, cache invalidation
- `src/preferences-page.ts` — Pack dropdown, sound slots list with preview/override/reset
- `src/preferences-page.css` — Styles for new sound slot rows

### Assets
- `public/sounds/` — Move existing files into `default/` subfolder, add `retro/` and `mechanical/` folders

### Config
- `src-tauri/tauri.conf.json` — Update sound resource paths if needed, add dialog plugin permissions

## Edge Cases

- **Missing override file:** If a user-selected file is moved/deleted, `convertFileSrc` will fail silently (Audio play catch handles this). The override path stays in config — user can reset it.
- **Pack switch with overrides:** Overrides persist across pack switches. Only the non-overridden sounds change.
- **Backward compatibility:** Existing configs without `pack` or `overrides` fields use serde defaults (`"default"` and empty map).
