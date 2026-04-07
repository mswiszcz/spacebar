# Icon Display Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an alternative icon display mode per agent type — branded icon + status dot instead of the full animated mascot.

**Architecture:** Extend `MascotDefinition` with an optional `icon` field. The mascot-grid renderer branches on a per-agent `display_modes` config to render either full mascot SVG or icon+dot. Two new preferences in the Layout tab control display mode per agent and status dot corner.

**Tech Stack:** TypeScript (frontend), Rust (backend config), CSS animations, SVG

---

### Task 1: Add display mode fields to backend config

**Files:**
- Modify: `src-tauri/src/config.rs:1-225`

- [ ] **Step 1: Add fields to Config struct**

Add `display_modes` and `status_dot_corner` to the `Config` struct with serde defaults:

```rust
#[serde(default)]
pub display_modes: HashMap<String, String>,
#[serde(default = "default_status_dot_corner")]
pub status_dot_corner: String,
```

Add the default function:

```rust
fn default_status_dot_corner() -> String {
    "top-left".into()
}
```

Add the fields to `impl Default for Config`:

```rust
display_modes: HashMap::new(),
status_dot_corner: default_status_dot_corner(),
```

- [ ] **Step 2: Add backward compatibility test**

Add a test in the existing `#[cfg(test)] mod tests` block:

```rust
#[test]
fn test_display_modes_backward_compat() {
    let json = r##"{
        "orientation": "horizontal",
        "alwaysOnTop": true,
        "mascotSize": "medium",
        "showLabels": true,
        "showTooltips": true,
        "position": {"x": 100, "y": 100},
        "sound": {"enabled": true, "volume": 0.5},
        "theme": {
            "backgroundColor": "#1a1a2e",
            "backgroundOpacity": 0.8,
            "blurRadius": 20,
            "accentColor": "#E8825A"
        }
    }"##;
    let parsed: Config = serde_json::from_str(json).unwrap();
    assert!(parsed.display_modes.is_empty());
    assert_eq!(parsed.status_dot_corner, "top-left");
}
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass, including the new backward compat test.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add display_modes and status_dot_corner to config"
```

---

### Task 2: Extend MascotDefinition with icon field

**Files:**
- Modify: `src/mascots/types.ts`

- [ ] **Step 1: Add IconDefinition interface and icon field**

Add the `IconDefinition` interface and extend `MascotDefinition`:

```typescript
export interface IconDefinition {
  svg: string;
}

export interface MascotDefinition {
  svg(state: MascotState): string;
  css: string;
  metadata: {
    name: string;
    defaultColor: string;
    size: { width: number; height: number };
  };
  icon?: IconDefinition;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mascots/types.ts
git commit -m "feat: add optional icon field to MascotDefinition"
```

---

### Task 3: Add icon SVGs to claude-code mascot and registry

**Files:**
- Modify: `src/mascots/claude-code.ts`
- Modify: `src/mascots/registry.ts`

- [ ] **Step 1: Add icon to claude-code definition**

Add the Anthropic logo SVG (stylized "A" mark) as the `icon` field on the `claudeCode` export in `src/mascots/claude-code.ts`. Add it after the `metadata` field:

```typescript
icon: {
  svg: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.827 3.52l5.51 16.96H14.98l-1.166-3.744h-3.665L11.2 20.48H6.663L12.174 3.52h1.653zm-.844 5.38l-1.22 5.118h2.853L13.49 8.9h-.507z"/>
  </svg>`,
},
```

- [ ] **Step 2: Add fallback icon to registry**

In `src/mascots/registry.ts`, add a `FALLBACK_ICON` constant and a `getMascotIcon` export function:

```typescript
import { MascotDefinition, IconDefinition } from "./types";
import { claudeCode } from "./claude-code";

const FALLBACK_ICON: IconDefinition = {
  svg: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 17.5v-11A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5zm3-8.5v2h2V9H7zm8 0v2h2V9h-2zm-6 4v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V13H9z"/>
  </svg>`,
};

const mascots: Record<string, MascotDefinition> = {
  "claude-code": claudeCode,
};

export function getMascot(agent: string): MascotDefinition {
  return mascots[agent] ?? mascots["claude-code"];
}

export function getMascotIcon(agent: string): IconDefinition {
  const mascot = mascots[agent] ?? mascots["claude-code"];
  return mascot.icon ?? FALLBACK_ICON;
}

export function hasIcon(agent: string): boolean {
  const mascot = mascots[agent];
  return mascot?.icon != null;
}

export function getAllMascotCSS(): string {
  return Object.values(mascots)
    .map((m) => m.css)
    .join("\n");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/mascots/claude-code.ts src/mascots/registry.ts
git commit -m "feat: add Anthropic icon to claude-code, add fallback icon to registry"
```

---

### Task 4: Add icon mode CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add icon sizing CSS variables**

Append after the existing size variants section (after line 156) in `src/styles.css`:

```css
/* Icon mode sizes (smaller than mascot) */
.size-small .mascot-item.icon-mode { --icon-size: 24px; }
.size-medium .mascot-item.icon-mode { --icon-size: 36px; }
.size-large .mascot-item.icon-mode { --icon-size: 48px; }

.mascot-item.icon-mode {
  width: var(--icon-size, 36px);
}

/* Icon wrapper */
.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-size, 36px);
  height: var(--icon-size, 36px);
  color: var(--accent-color, #E8825A);
}

.icon-wrapper svg {
  width: 100%;
  height: 100%;
}

/* Status dot */
.status-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1.5px solid var(--bg-color, #1a1a2e);
  display: none;
  z-index: 1;
}

/* Corner positions */
.dot-top-left { top: -1px; left: -1px; }
.dot-top-right { top: -1px; right: -1px; }
.dot-bottom-left { bottom: -1px; left: -1px; }
.dot-bottom-right { bottom: -1px; right: -1px; }

/* State colors and visibility */
.status-dot.dot-thinking,
.status-dot.dot-compacting {
  display: block;
  background: #facc15;
  animation: dotPulse 1.5s ease-in-out infinite;
}

.status-dot.dot-needs-input,
.status-dot.dot-notification {
  display: block;
  background: #60a5fa;
  animation: dotPulse 1s ease-in-out infinite;
}

.status-dot.dot-error {
  display: block;
  background: #ef4444;
}

/* Dot pulse animation */
@keyframes dotPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

/* Icon state animations */
.icon-mode.state-thinking .icon-wrapper,
.icon-mode.state-compacting .icon-wrapper {
  animation: iconPulseOpacity 2s ease-in-out infinite;
}

.icon-mode.state-needs-input .icon-wrapper,
.icon-mode.state-notification .icon-wrapper {
  animation: iconPulseScale 1s ease-in-out infinite;
}

.icon-mode.state-sleeping .icon-wrapper {
  opacity: 0.5;
}

@keyframes iconPulseOpacity {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes iconPulseScale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add icon mode CSS — sizing, status dot, animations"
```

---

### Task 5: Update mascot-grid renderer for icon mode

**Files:**
- Modify: `src/mascot-grid.ts`

- [ ] **Step 1: Add config import and state**

Add a module-level variable to track the current config's display modes and dot corner. At the top of `src/mascot-grid.ts`, after the existing imports, add:

```typescript
import { getMascotIcon } from "./mascots/registry";
```

Add module-level state after the existing `lastKnownState` map:

```typescript
let displayModes: Record<string, string> = {};
let statusDotCorner = "top-left";

export function updateDisplayConfig(modes: Record<string, string>, corner: string): void {
  displayModes = modes;
  statusDotCorner = corner;
}
```

- [ ] **Step 2: Update createMascotElement to support icon mode**

Replace the `createMascotElement` function with a version that branches on display mode:

```typescript
function createMascotElement(session: Session): HTMLElement {
  const wrapper = document.createElement("div");
  const isIcon = displayModes[session.agent] === "icon";
  wrapper.className = `mascot-item state-idle${isIcon ? " icon-mode" : ""}`;
  wrapper.dataset.sessionId = session.sessionId;

  if (isIcon) {
    const iconDef = getMascotIcon(session.agent);
    const iconWrapper = document.createElement("div");
    iconWrapper.className = "icon-wrapper";
    iconWrapper.innerHTML = iconDef.svg;

    const dot = document.createElement("div");
    dot.className = `status-dot dot-${statusDotCorner}`;

    wrapper.appendChild(iconWrapper);
    wrapper.appendChild(dot);
  } else {
    const mascotWrapper = document.createElement("div");
    mascotWrapper.className = "mascot-wrapper";
    const mascot = getMascot(session.agent);
    mascotWrapper.innerHTML = mascot.svg("idle" as MascotState);
    wrapper.appendChild(mascotWrapper);
  }

  const label = document.createElement("div");
  label.className = "mascot-label";
  label.textContent = session.state;
  wrapper.appendChild(label);

  lastKnownState.set(session.sessionId, session.state);
  if (session.state === "idle") {
    startSleepTimer(wrapper, session);
  }

  wrapper.addEventListener("click", () => {
    invoke("execute_click", { sessionId: session.sessionId });
  });

  wrapper.addEventListener("mouseenter", () => {
    const currentSession = sessionState.get(session.sessionId);
    if (currentSession) {
      showTooltip(currentSession, wrapper);
    }
  });
  wrapper.addEventListener("mouseleave", () => {
    hideTooltip();
  });

  return wrapper;
}
```

- [ ] **Step 3: Update updateMascotElement for icon mode**

Replace the `updateMascotElement` function:

```typescript
function updateMascotElement(el: HTMLElement, session: Session): void {
  const state = session.state as MascotState;
  const prev = lastKnownState.get(session.sessionId);
  if (prev === state) return;
  if (prev === "sleeping" && state === "idle") return;
  lastKnownState.set(session.sessionId, state);

  const silent = silentUpdates.has(session.sessionId);
  silentUpdates.delete(session.sessionId);
  playStateSound(state, silent);

  const isIcon = el.classList.contains("icon-mode");
  el.className = `mascot-item state-${state}${isIcon ? " icon-mode" : ""}`;
  el.dataset.sessionId = session.sessionId;

  if (isIcon) {
    // Update status dot class
    const dot = el.querySelector(".status-dot") as HTMLElement;
    if (dot) {
      // Remove old state classes
      dot.className = `status-dot dot-${statusDotCorner}`;
      // Add state-specific class (only for states that show a dot)
      const dotStates = ["thinking", "needs-input", "error", "compacting", "notification"];
      if (dotStates.includes(state)) {
        dot.classList.add(`dot-${state}`);
      }
    }
  } else {
    const mascot = getMascot(session.agent);
    const wrapper = el.querySelector(".mascot-wrapper");
    if (wrapper) {
      wrapper.innerHTML = mascot.svg(state);
    }
  }

  const label = el.querySelector(".mascot-label");
  if (label) {
    label.textContent = state;
  }

  clearSleepTimer(session.sessionId);
  if (state === "idle") {
    startSleepTimer(el, session);
  }
}
```

- [ ] **Step 4: Update triggerExit for icon mode**

In the `triggerExit` function, skip the mascot SVG swap when in icon mode:

```typescript
export function triggerExit(
  container: HTMLElement,
  sessionId: string
): Promise<void> {
  return new Promise((resolve) => {
    const el = container.querySelector(
      `[data-session-id="${sessionId}"]`
    ) as HTMLElement | null;

    if (el) {
      playStateSound("exiting");
      const isIcon = el.classList.contains("icon-mode");
      el.className = `mascot-item state-exiting${isIcon ? " icon-mode" : ""}`;
      if (!isIcon) {
        const mascot = getMascot("claude-code");
        const wrapper = el.querySelector(".mascot-wrapper");
        if (wrapper) {
          wrapper.innerHTML = mascot.svg("exiting");
        }
      }
      setTimeout(() => {
        el.remove();
        resolve();
      }, 400);
    } else {
      resolve();
    }
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/mascot-grid.ts
git commit -m "feat: mascot-grid renders icon mode with status dot"
```

---

### Task 6: Wire display config into main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add Config fields and wire updateDisplayConfig**

In `src/main.ts`, add the new fields to the `Config` interface:

```typescript
displayModes: Record<string, string>;
statusDotCorner: string;
```

Add the import of `updateDisplayConfig` from `./mascot-grid`:

```typescript
import { initMascotGrid, triggerExit, markSilentUpdate, updateDisplayConfig } from "./mascot-grid";
```

In the `applyConfig` function, add a call to `updateDisplayConfig` before the `resizeWindow()` call:

```typescript
// Apply display mode config
updateDisplayConfig(config.displayModes ?? {}, config.statusDotCorner ?? "top-left");
```

- [ ] **Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire display mode config into applyConfig"
```

---

### Task 7: Add preferences UI controls

**Files:**
- Modify: `src/preferences-page.ts`

- [ ] **Step 1: Add Config fields to preferences interface**

In the `Config` interface in `src/preferences-page.ts`, add:

```typescript
displayModes: Record<string, string>;
statusDotCorner: string;
```

- [ ] **Step 2: Add display mode controls to Layout tab**

In the `renderLayoutPage` function, add two new preference rows after the "Split View Overflow" row (before the closing `</div>` of `prefs-section`):

```typescript
<div class="prefs-row">
  <div class="prefs-row-info">
    <span class="prefs-row-label">Display Mode</span>
    <span class="prefs-row-hint">Show mascot or icon per agent type</span>
  </div>
  <div id="pref-display-modes"></div>
</div>

<div class="prefs-row" id="pref-dot-corner-row" style="display: ${Object.values(config.displayModes ?? {}).includes("icon") ? "flex" : "none"}">
  <div class="prefs-row-info">
    <span class="prefs-row-label">Status Dot Corner</span>
    <span class="prefs-row-hint">Position of status indicator on icons</span>
  </div>
  <select class="prefs-select" id="pref-dot-corner">
    <option value="top-left" ${(config.statusDotCorner ?? "top-left") === "top-left" ? "selected" : ""}>Top-Left</option>
    <option value="top-right" ${config.statusDotCorner === "top-right" ? "selected" : ""}>Top-Right</option>
    <option value="bottom-left" ${config.statusDotCorner === "bottom-left" ? "selected" : ""}>Bottom-Left</option>
    <option value="bottom-right" ${config.statusDotCorner === "bottom-right" ? "selected" : ""}>Bottom-Right</option>
  </select>
</div>
```

- [ ] **Step 3: Add rendering and binding for display mode selectors**

Add a new function `renderDisplayModes` after the `renderSoundSlots` function:

```typescript
function renderDisplayModes(config: Config, save: () => Promise<void>): void {
  if (!config.displayModes) config.displayModes = {};
  const container = document.getElementById("pref-display-modes");
  if (!container) return;

  // Get unique agent types from active sessions via the config's display_modes keys
  // plus "claude-code" as the default always-present agent
  const agentTypes = new Set<string>(["claude-code", ...Object.keys(config.displayModes)]);

  container.innerHTML = Array.from(agentTypes).map(agent => {
    const mode = config.displayModes[agent] ?? "mascot";
    return `
      <div class="display-mode-row" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:11px;color:#aaa;min-width:80px;">${agent}</span>
        <select class="prefs-select" data-agent="${agent}" style="min-width:90px;">
          <option value="mascot" ${mode === "mascot" ? "selected" : ""}>Mascot</option>
          <option value="icon" ${mode === "icon" ? "selected" : ""}>Icon</option>
        </select>
      </div>`;
  }).join("");

  container.addEventListener("change", (e) => {
    const select = e.target as HTMLSelectElement;
    const agent = select.dataset.agent;
    if (!agent) return;
    const value = select.value;
    if (value === "mascot") {
      delete config.displayModes[agent];
    } else {
      config.displayModes[agent] = value;
    }
    // Show/hide dot corner row
    const dotRow = document.getElementById("pref-dot-corner-row");
    if (dotRow) {
      const hasIcon = Object.values(config.displayModes).includes("icon");
      dotRow.style.display = hasIcon ? "flex" : "none";
    }
    save();
  });
}
```

- [ ] **Step 4: Bind the new controls in init()**

In the `init()` function, after the existing `bindSelect("#pref-split-overflow", ...)` call, add:

```typescript
renderDisplayModes(config, save);

bindSelect("#pref-dot-corner", (v) => {
  config.statusDotCorner = v;
  save();
});
```

- [ ] **Step 5: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: add display mode and status dot corner to preferences UI"
```

---

### Task 8: Run full build and manual verification

**Files:** None (verification only)

- [ ] **Step 1: Build the Rust backend**

Run: `cd src-tauri && cargo build`
Expected: Compiles without errors.

- [ ] **Step 2: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass.

- [ ] **Step 3: Build the frontend**

Run: `npm run build` (or the project's build command)
Expected: Compiles without TypeScript errors.

- [ ] **Step 4: Manual smoke test**

Launch the app and verify:
1. Default behavior: all sessions show mascot mode (no regression)
2. Open Preferences > Layout > set claude-code to "Icon" mode
3. Verify icon renders with correct sizing and accent color
4. Verify status dot appears/disappears on state changes
5. Change dot corner position and verify it moves
6. Switch back to "Mascot" mode and verify full mascot returns
7. Verify tooltips, click, and sounds still work in icon mode

- [ ] **Step 5: Commit any fixes if needed**

```bash
git add -u
git commit -m "fix: address issues found during smoke test"
```
