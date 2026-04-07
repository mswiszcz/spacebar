# States Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nested `SoundConfig` with top-level sound globals and a per-state `states` map that holds color + sound settings.

**Architecture:** Dissolve `SoundConfig` in Rust. Promote `sound_enabled`, `sound_volume`, `sound_pack` to top-level `Config` fields. Add `states: HashMap<String, StateConfig>` where each `StateConfig` holds optional color, optional sound override, and muted flag. Frontend reads new fields for sound resolution, icon dot colors, and preferences UI.

**Tech Stack:** Rust (serde), TypeScript, CSS

---

### Task 1: Update Rust config struct

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Remove `SoundConfig` and add `StateConfig` + new top-level fields**

Replace the `SoundConfig` struct and update `Config`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateConfig {
    pub color: Option<String>,
    pub sound_override: Option<String>,
    #[serde(default)]
    pub muted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub orientation: String,
    pub always_on_top: bool,
    pub mascot_size: String,
    pub show_labels: bool,
    pub show_tooltips: bool,
    pub position: Position,
    #[serde(default = "default_sound_enabled")]
    pub sound_enabled: bool,
    #[serde(default = "default_sound_volume")]
    pub sound_volume: f64,
    #[serde(default = "default_sound_pack")]
    pub sound_pack: String,
    pub theme: ThemeConfig,
    #[serde(default)]
    pub group_renames: HashMap<String, String>,
    #[serde(default)]
    pub snap: SnapConfig,
    #[serde(default)]
    pub split_view: SplitViewConfig,
    #[serde(default)]
    pub display_modes: HashMap<String, String>,
    #[serde(default = "default_status_dot_corner")]
    pub status_dot_corner: String,
    #[serde(default)]
    pub states: HashMap<String, StateConfig>,
}
```

Add default functions:

```rust
fn default_sound_enabled() -> bool {
    true
}

fn default_sound_volume() -> f64 {
    0.5
}

fn default_sound_pack() -> String {
    "default".into()
}
```

Remove the old `SoundConfig` struct entirely, and the `default_pack` function.

- [ ] **Step 2: Update `Default` impl for `Config`**

Replace the `sound: SoundConfig { ... }` field in `impl Default for Config` with:

```rust
sound_enabled: true,
sound_volume: 0.5,
sound_pack: "default".into(),
states: HashMap::new(),
```

- [ ] **Step 3: Update tests**

Replace all tests in `mod tests`. Remove the `test_sound_config_backward_compat` test. Update the other tests that include `"sound"` in their JSON to use the new top-level fields instead. The minimal config JSON for tests becomes:

```rust
#[test]
fn test_default_config_serializes() {
    let config = Config::default();
    let json = serde_json::to_string(&config).unwrap();
    let parsed: Config = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.orientation, "horizontal");
    assert_eq!(parsed.theme.blur_radius, 20);
    assert!(parsed.sound_enabled);
    assert_eq!(parsed.sound_pack, "default");
    assert!(parsed.states.is_empty());
}

#[test]
fn test_state_config_deserializes() {
    let json = r#"{"color": "#ff0000", "muted": true}"#;
    let parsed: StateConfig = serde_json::from_str(json).unwrap();
    assert_eq!(parsed.color, Some("#ff0000".into()));
    assert!(parsed.muted);
    assert!(parsed.sound_override.is_none());
}

#[test]
fn test_snap_config_defaults() {
    let json = r##"{
        "orientation": "horizontal",
        "alwaysOnTop": true,
        "mascotSize": "medium",
        "showLabels": true,
        "showTooltips": true,
        "position": {"x": 100, "y": 100},
        "theme": {
            "backgroundColor": "#1a1a2e",
            "backgroundOpacity": 0.8,
            "blurRadius": 20,
            "accentColor": "#E8825A"
        }
    }"##;
    let parsed: Config = serde_json::from_str(json).unwrap();
    assert!(!parsed.snap.enabled);
    assert_eq!(parsed.snap.edge_padding, 4);
    assert!(parsed.snap.snapped_edge.is_none());
    assert!(parsed.sound_enabled);
    assert!(parsed.states.is_empty());
}
```

- [ ] **Step 4: Build and verify**

Run: `cd src-tauri && cargo build 2>&1 | head -30`
Expected: Successful build (or only unrelated warnings)

- [ ] **Step 5: Run tests**

Run: `cd src-tauri && cargo test 2>&1`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: replace SoundConfig with top-level sound fields and states map"
```

---

### Task 2: Update frontend Config interfaces and sound.ts

**Files:**
- Modify: `src/main.ts`
- Modify: `src/sound.ts`

- [ ] **Step 1: Update `Config` interface in `main.ts`**

Replace the `sound` field in the `Config` interface (line 17) with:

```typescript
soundEnabled: boolean;
soundVolume: number;
soundPack: string;
states: Record<string, { color?: string; soundOverride?: string; muted?: boolean }>;
```

Remove the `sound: { ... }` line entirely.

- [ ] **Step 2: Update `applyConfig` in `main.ts`**

Replace the `updateSoundSettings` call (line 124) with:

```typescript
// Build overrides and muted list from states for sound module
const soundOverrides: Record<string, string> = {};
const soundMuted: string[] = [];
for (const [state, cfg] of Object.entries(config.states ?? {})) {
  if (cfg.soundOverride) soundOverrides[state] = cfg.soundOverride;
  if (cfg.muted) soundMuted.push(state);
}
updateSoundSettings(config.soundEnabled, config.soundVolume, config.soundPack, soundOverrides, soundMuted);
```

- [ ] **Step 3: Update `initSound` in `sound.ts`**

Replace the config type in `initSound` (lines 20-29) to read from new top-level fields:

```typescript
export async function initSound(): Promise<void> {
  const config = await invoke<{
    soundEnabled?: boolean;
    soundVolume?: number;
    soundPack?: string;
    states?: Record<string, { soundOverride?: string; muted?: boolean }>;
  }>("get_config");
  enabled = config.soundEnabled ?? true;
  volume = config.soundVolume ?? 0.5;
  activePack = config.soundPack ?? "default";
  overrides = {};
  muted = [];
  for (const [state, cfg] of Object.entries(config.states ?? {})) {
    if (cfg.soundOverride) overrides[state] = cfg.soundOverride;
    if (cfg.muted) muted.push(state);
  }
}
```

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -10`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/sound.ts
git commit -m "feat: update frontend to read sound settings from new config shape"
```

---

### Task 3: Config-driven status dot colors in mascot-grid.ts

**Files:**
- Modify: `src/mascot-grid.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add states config to mascot-grid module**

Add a module-level variable and updater. Near the top of `mascot-grid.ts`, after the `statusDotCorner` declaration (line 13), add:

```typescript
let statesConfig: Record<string, { color?: string }> = {};
let accentColor = "#E8825A";
```

Update the `updateDisplayConfig` function signature and body to accept and store these:

```typescript
export function updateDisplayConfig(
  modes: Record<string, string>,
  corner: string,
  states: Record<string, { color?: string }>,
  accent: string,
): void {
  const changed = JSON.stringify(displayModes) !== JSON.stringify(modes)
    || statusDotCorner !== corner
    || JSON.stringify(statesConfig) !== JSON.stringify(states)
    || accentColor !== accent;
  displayModes = modes;
  statusDotCorner = corner;
  statesConfig = states;
  accentColor = accent;
  if (changed) rebuildAllSessions();
}
```

- [ ] **Step 2: Apply color via inline style instead of CSS classes**

In `createMascotElement`, when creating the dot (around line 215), set its color inline:

```typescript
const dot = document.createElement("div");
dot.className = `status-dot dot-${statusDotCorner}`;
dot.style.display = "block";
dot.style.background = statesConfig["idle"]?.color ?? accentColor;
```

In `updateMascotElement`, replace the dot class update block (lines 286-294) with:

```typescript
if (isIcon) {
  const dot = el.querySelector(".status-dot") as HTMLElement;
  if (dot) {
    dot.className = `status-dot dot-${statusDotCorner}`;
    dot.style.display = "block";
    dot.style.background = statesConfig[state]?.color ?? accentColor;
  }
}
```

- [ ] **Step 3: Remove hardcoded dot color CSS classes from styles.css**

Remove these CSS rules from `src/styles.css` (the `dot-idle`, `dot-thinking`, `dot-compacting`, `dot-needs-input`, `dot-notification`, `dot-error` rules and the `dot-needs-input::after` / `dot-notification::after` pulse animation). The `.status-dot` base rule stays (position, size, border-radius, border, z-index, transition). The `.dot-top-left` etc. corner position rules stay.

Keep the `.status-dot` base rule but change `display: none` to `display: block` since visibility is now always controlled inline.

- [ ] **Step 4: Update call site in main.ts**

Update the `updateDisplayConfig` call in `applyConfig` (line 118 of main.ts):

```typescript
updateDisplayConfig(
  config.displayModes ?? {},
  config.statusDotCorner ?? "top-left",
  config.states ?? {},
  config.theme.accentColor,
);
```

- [ ] **Step 5: Build and verify**

Run: `npm run build 2>&1 | tail -10`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/mascot-grid.ts src/styles.css src/main.ts
git commit -m "feat: config-driven status dot colors from states map"
```

---

### Task 4: Preferences UI — replace Sound tab with States tab

**Files:**
- Modify: `src/preferences-page.ts`

- [ ] **Step 1: Update `Config` interface in preferences-page.ts**

Replace the `sound` field (line 12) with:

```typescript
soundEnabled: boolean;
soundVolume: number;
soundPack: string;
states: Record<string, { color?: string; soundOverride?: string; muted?: boolean }>;
```

- [ ] **Step 2: Update TABS array**

Replace the sound tab entry:

```typescript
{ id: "states", label: "States", icon: "◈" },
```

- [ ] **Step 3: Replace `renderSoundPage` with `renderStatesPage`**

Replace the entire `renderSoundPage` function with:

```typescript
function renderStatesPage(config: Config): string {
  return `
    <div class="prefs-page" data-page="states">
      <div class="prefs-page-title">States</div>

      <div class="prefs-section">
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Sound Effects</span>
            <span class="prefs-row-hint">Play sounds on agent state changes</span>
          </div>
          ${toggleSwitch("pref-sound-enabled", config.soundEnabled)}
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Volume</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-sound-volume" min="0" max="100" value="${Math.round(config.soundVolume * 100)}">
            <span class="prefs-range-value" id="pref-sound-volume-val">${Math.round(config.soundVolume * 100)}%</span>
          </div>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Sound Pack</span>
          </div>
          <select class="prefs-select" id="pref-sound-pack">
            <option value="default" ${config.soundPack === "default" ? "selected" : ""}>Default</option>
            <option value="retro" ${config.soundPack === "retro" ? "selected" : ""}>Retro</option>
            <option value="sci-fi" ${config.soundPack === "sci-fi" ? "selected" : ""}>Sci-Fi Console</option>
            <option value="zen" ${config.soundPack === "zen" ? "selected" : ""}>Zen</option>
            <option value="arcade" ${config.soundPack === "arcade" ? "selected" : ""}>Arcade</option>
            <option value="typewriter" ${config.soundPack === "typewriter" ? "selected" : ""}>Typewriter</option>
            <option value="bubble-pop" ${config.soundPack === "bubble-pop" ? "selected" : ""}>Bubble Pop</option>
            <option value="glitch" ${config.soundPack === "glitch" ? "selected" : ""}>Glitch</option>
            <option value="xylophone" ${config.soundPack === "xylophone" ? "selected" : ""}>Xylophone</option>
            <option value="synth-pad" ${config.soundPack === "synth-pad" ? "selected" : ""}>Synth Pad</option>
            <option value="ui-minimal" ${config.soundPack === "ui-minimal" ? "selected" : ""}>UI Minimal</option>
            <option value="nature" ${config.soundPack === "nature" ? "selected" : ""}>Nature</option>
          </select>
        </div>
      </div>

      <div class="prefs-section">
        <div class="prefs-section-title">Per-State Settings</div>
        <div class="state-slots" id="state-slots"></div>
      </div>
    </div>
  `;
}
```

Update the call in `init()` from `renderSoundPage(config)` to `renderStatesPage(config)`.

- [ ] **Step 4: Replace `renderSoundSlots` with `renderStateSlots`**

Replace `SOUND_STATES`, `SOUND_MAP`, `resolveSoundUrl`, and `renderSoundSlots` with:

```typescript
const STATE_ENTRIES: { key: string; label: string }[] = [
  { key: "idle", label: "Idle" },
  { key: "thinking", label: "Thinking" },
  { key: "needs-input", label: "Input" },
  { key: "error", label: "Error" },
  { key: "compacting", label: "Compacting" },
  { key: "notification", label: "Notify" },
  { key: "entering", label: "Entering" },
  { key: "exiting", label: "Exiting" },
  { key: "sleeping", label: "Sleeping" },
];

const SOUND_MAP: Record<string, string> = {
  entering: "enter.wav",
  exiting: "exit.wav",
  thinking: "tick.wav",
  "needs-input": "ping.wav",
  error: "buzz.wav",
  compacting: "squeeze.wav",
  notification: "bell.wav",
};

function resolveSoundUrl(state: string, pack: string, soundOverride?: string): string | null {
  if (soundOverride) return convertFileSrc(soundOverride);
  const file = SOUND_MAP[state];
  if (!file) return null;
  return `/sounds/${pack}/${file}`;
}

function renderStateSlots(config: Config, save: () => Promise<void>): void {
  if (!config.states) config.states = {};
  const container = document.getElementById("state-slots")!;
  container.innerHTML = STATE_ENTRIES.map(({ key, label }) => {
    const stateConf = config.states[key];
    const isMuted = stateConf?.muted ?? false;
    const hasOverride = !!stateConf?.soundOverride;
    const hasSound = !!SOUND_MAP[key];
    const source = hasOverride
      ? stateConf!.soundOverride!.split("/").pop()
      : hasSound ? "Pack default" : "";
    const color = stateConf?.color ?? "";
    return `
      <div class="state-slot${isMuted ? " state-slot-muted" : ""}" data-state="${key}">
        <span class="state-slot-label">${label}</span>
        <input type="color" class="state-slot-color" data-action="color" value="${color || config.theme.accentColor}" title="State color">
        ${color ? `<button class="sound-slot-btn sound-slot-reset" data-action="reset-color" title="Reset color">&#10005;</button>` : ""}
        ${hasSound ? `
          <label class="sound-slot-mute-toggle">
            <input type="checkbox" data-action="mute" ${isMuted ? "" : "checked"}>
            <span class="sound-slot-mute-slider"></span>
          </label>
          <span class="state-slot-source" title="${hasOverride ? stateConf!.soundOverride! : ""}">${source}</span>
          <button class="sound-slot-btn" data-action="play" title="Preview"${isMuted ? " disabled" : ""}>&#9654;</button>
          <button class="sound-slot-btn" data-action="pick" title="Choose file"${isMuted ? " disabled" : ""}>&#128194;</button>
          ${hasOverride ? `<button class="sound-slot-btn sound-slot-reset" data-action="reset-sound" title="Reset to pack"${isMuted ? " disabled" : ""}>&#10005;</button>` : ""}
        ` : ""}
      </div>`;
  }).join("");

  container.onclick = async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("[data-action]") as HTMLElement | null;
    if (!btn) return;
    const slot = btn.closest(".state-slot") as HTMLElement;
    const state = slot.dataset.state!;
    const action = btn.dataset.action;

    // Ensure state entry exists
    if (!config.states[state]) config.states[state] = {};

    if (action === "mute") {
      config.states[state].muted = !config.states[state].muted;
      await save();
      renderStateSlots(config, save);
    } else if (action === "color") {
      // Handled by input event below
    } else if (action === "reset-color") {
      delete config.states[state].color;
      cleanupStateEntry(config, state);
      await save();
      renderStateSlots(config, save);
    } else if (action === "play") {
      const url = resolveSoundUrl(state, config.soundPack, config.states[state]?.soundOverride);
      if (url) {
        const audio = new Audio(url);
        audio.volume = config.soundVolume;
        audio.play().catch(() => {});
      }
    } else if (action === "pick") {
      const path = await invoke<string | null>("pick_sound_file");
      if (path) {
        config.states[state].soundOverride = path;
        await save();
        renderStateSlots(config, save);
      }
    } else if (action === "reset-sound") {
      delete config.states[state].soundOverride;
      cleanupStateEntry(config, state);
      await save();
      renderStateSlots(config, save);
    }
  };

  // Color input change handler
  container.querySelectorAll<HTMLInputElement>(".state-slot-color").forEach((input) => {
    input.addEventListener("input", async () => {
      const slot = input.closest(".state-slot") as HTMLElement;
      const state = slot.dataset.state!;
      if (!config.states[state]) config.states[state] = {};
      config.states[state].color = input.value;
      await save();
    });
    // Re-render on change (mouseup after picker closes) to show reset button
    input.addEventListener("change", () => renderStateSlots(config, save));
  });
}

/** Remove empty state entries to keep config clean */
function cleanupStateEntry(config: Config, state: string): void {
  const entry = config.states[state];
  if (entry && !entry.color && !entry.soundOverride && !entry.muted) {
    delete config.states[state];
  }
}
```

- [ ] **Step 5: Update bindings in `init()`**

Replace the sound binding lines (lines 117-120):

```typescript
bindCheckbox("#pref-sound-enabled", (v) => { config.soundEnabled = v; save(); });
bindRange("#pref-sound-volume", (v) => { config.soundVolume = v / 100; save(); });
bindSelect("#pref-sound-pack", (v) => { config.soundPack = v; save(); renderStateSlots(config, save); });
renderStateSlots(config, save);
```

- [ ] **Step 6: Build and verify**

Run: `npm run build 2>&1 | tail -10`
Expected: No TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: replace Sound tab with States tab in preferences"
```

---

### Task 5: Add CSS for state slots

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add state-slot styles**

Find the existing `.sound-slot` styles in `styles.css` and add parallel styles for `.state-slot`. The state slot reuses most sound-slot styling but adds the color picker. Add after the existing sound-slot styles (or replace them if sound-slot is no longer used):

```css
.state-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: opacity 0.15s;
}

.state-slot-muted {
  opacity: 0.45;
}

.state-slot-label {
  min-width: 80px;
  font-size: 12px;
  color: #ccc;
}

.state-slot-color {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  background: none;
}

.state-slot-color::-webkit-color-swatch-wrapper {
  padding: 0;
}

.state-slot-color::-webkit-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.state-slot-source {
  flex: 1;
  font-size: 11px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: Remove old `.sound-slot` styles if they exist**

If `.sound-slot` CSS rules exist and are no longer referenced, remove them. Keep `.sound-slot-btn`, `.sound-slot-reset`, `.sound-slot-mute-toggle`, and `.sound-slot-mute-slider` since `renderStateSlots` still uses those class names for the sound controls within each state row.

- [ ] **Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: add state-slot CSS for per-state settings UI"
```

---

### Task 6: Delete old config and manual test

**Files:** None (manual verification)

- [ ] **Step 1: Delete old config file**

Run: `rm -f ~/.spacebar/config.json`

- [ ] **Step 2: Build and run the app**

Run: `npm run tauri dev 2>&1 | head -50`

Verify:
- App launches with default config
- Opening preferences shows "States" tab instead of "Sound"
- States tab shows sound globals at top, per-state rows below
- Each state row has a color picker and sound controls (where applicable)
- Changing a state color saves to config
- Icon mode status dots use the configured state color
- Sound preview, mute, and override still work

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
