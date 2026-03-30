# Sound Mute Toggles & CLI `--no-sound`

## Summary

Add per-state mute toggles in the preferences UI and a `--no-sound` flag on the CLI `update` command. These are two independent mechanisms that both suppress sound playback.

## Config Change

Add `muted: Vec<String>` to `SoundConfig` in `src-tauri/src/config.rs`:

```rust
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f64,
    pub pack: String,
    pub overrides: HashMap<String, String>,
    pub muted: Vec<String>, // e.g. ["thinking", "compacting"]
}
```

Default: `[]` (empty — all states audible). Backward compatible with existing configs.

## Sound Playback Logic

In `src/sound.ts`, `playStateSound(state, noSound?)` plays audio only when ALL conditions are met:

1. Global `enabled` is `true`
2. State is NOT in the `muted` list
3. `noSound` parameter is `false` (or absent)

## Preferences UI

In `src/preferences-page.ts`, each sound slot row gains a mute toggle. Toggling adds/removes the state key from `config.sound.muted` and saves immediately.

Layout per row:
```
[Mute Toggle] [Label] [Current Source] [Play] [Pick File] [Reset]
```

When a state is muted, the play/pick/reset controls should appear dimmed/disabled.

## CLI `--no-sound` Flag

Added to the `Update` command in `cli/src/main.rs`:

```
spacebar update --session-id X --state thinking --no-sound
```

- `--no-sound` is an optional boolean flag (default: false)
- Passed in the HTTP POST body as `no_sound: bool`

## Server & Event Propagation

1. `UpdateBody` in `src-tauri/src/server.rs` gains `no_sound: bool` field (default false via serde)
2. The `session-updated` Tauri event payload includes `no_sound`
3. `cli/src/main.rs` `UpdateBody` gains `no_sound: bool` field

## Frontend Event Handling

In `src/mascot-grid.ts`, the `session-updated` event handler checks the `no_sound` field before calling `playStateSound()`.

## Backward Compatibility

- `muted` defaults to `[]` — old configs without this field work unchanged
- `no_sound` defaults to `false` via `#[serde(default)]` — old CLI versions send no field, behaves as today
- Sound plays identically to current behavior when neither feature is used
