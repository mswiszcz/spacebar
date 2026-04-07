# States Config Design

**Date**: 2026-04-07
**Status**: Draft

## Summary

Extract per-state settings (sound overrides, muted) from the nested `SoundConfig` into a new top-level `states` config map. Add per-state icon color. Dissolve `SoundConfig` entirely — sound globals become top-level fields.

## Config Structure

### Rust (config.rs)

```rust
pub struct Config {
    // ... existing fields ...

    // Sound globals (promoted from dissolved SoundConfig)
    pub sound_enabled: bool,        // default true
    pub sound_volume: f64,          // 0.0-1.0, default 1.0
    pub sound_pack: String,         // default "default"

    // Per-state settings
    pub states: HashMap<String, StateConfig>,

    // ... existing fields (theme, display_modes, etc.) ...
}

pub struct StateConfig {
    pub color: Option<String>,          // hex color, falls back to theme.accent_color
    pub sound_override: Option<String>, // custom sound file path
    pub muted: bool,                    // default false
}
```

`SoundConfig` struct is removed entirely. No migration — old config file is deleted manually.

### Resolution Logic

**Color**: `config.states[state]?.color ?? config.theme.accent_color`

**Sound URL**: `config.states[state]?.sound_override ?? /sounds/{pack}/{default_filename}`

**Muted**: `config.states[state]?.muted ?? false`

Only states the user has customized appear in the map. Missing state = all defaults.

## Frontend Changes

### sound.ts

- `initSound()` reads `sound_enabled`, `sound_volume`, `sound_pack` from top-level config
- `resolveSoundUrl(state)` checks `config.states[state]?.sound_override`, then pack default
- Mute check reads `config.states[state]?.muted`

### mascot-grid.ts (icon mode)

- Status dot color driven by `config.states[state]?.color ?? config.theme.accent_color`
- No CSS class-based state colors — entirely config-driven

### preferences-page.ts

The **Sound tab** is replaced by a **States tab**:

- **Top section**: Sound globals (enable toggle, volume slider, pack selector)
- **Per-state rows** (one row per state):
  - State name label
  - Color picker (hex input + swatch)
  - Mute toggle
  - Sound override file picker + reset button
  - Preview (play) button

States shown: idle, thinking, needs-input, error, compacting, notification, entering, exiting, sleeping.

## Backwards Compatibility

None. Old `~/.spacebar/config.json` is deleted manually. The app starts fresh with defaults.
