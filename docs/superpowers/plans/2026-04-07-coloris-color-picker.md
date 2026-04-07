# Coloris Color Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native OS color dialogs with inline Coloris popovers and add palette-aware color suggestions using color theory.

**Architecture:** Install @melloware/coloris, replace all `<input type="color">` with `<input type="text" data-coloris>`, add a `color-utils.ts` module for HSL math and suggestion generation, and dynamically update Coloris swatches when any state color changes.

**Tech Stack:** @melloware/coloris, vanilla TypeScript, Vite

---

### Task 1: Install @melloware/coloris

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
npm install @melloware/coloris
```

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/@melloware/coloris/dist/coloris.css
```

Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @melloware/coloris dependency"
```

---

### Task 2: Create color-utils.ts

**Files:**
- Create: `src/color-utils.ts`

- [ ] **Step 1: Create the module with HSL conversion and suggestion generation**

```typescript
/** Convert hex (#rrggbb) to HSL tuple [0-360, 0-100, 0-100] */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, Math.round(l * 100)];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Convert HSL tuple to hex (#rrggbb) */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate suggested colors from the existing palette.
 * For each color in `otherColors`, produce complementary (180deg),
 * and analogous (+30deg, -30deg) variants. Deduplicate by hue proximity.
 * Returns up to 12 hex strings.
 */
export function generateSuggestions(otherColors: string[]): string[] {
  if (otherColors.length === 0) return [];

  const suggestions: Array<{ hex: string; h: number }> = [];

  for (const hex of otherColors) {
    const [h, s, l] = hexToHsl(hex);
    // Keep saturation and lightness balanced for suggestions
    const sl = Math.max(s, 40);
    const ll = Math.min(Math.max(l, 35), 65);

    suggestions.push({ hex: hslToHex((h + 180) % 360, sl, ll), h: (h + 180) % 360 });
    suggestions.push({ hex: hslToHex((h + 30) % 360, sl, ll), h: (h + 30) % 360 });
    suggestions.push({ hex: hslToHex((h + 330) % 360, sl, ll), h: (h + 330) % 360 });
  }

  // Deduplicate: skip colors whose hue is within 15deg of an already-kept color
  const kept: Array<{ hex: string; h: number }> = [];
  for (const entry of suggestions) {
    const tooClose = kept.some(k => {
      const diff = Math.abs(k.h - entry.h);
      return Math.min(diff, 360 - diff) < 15;
    });
    if (!tooClose) kept.push(entry);
  }

  return kept.slice(0, 12).map(k => k.hex);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/color-utils.ts
git commit -m "feat: add color-utils with HSL conversion and palette-aware suggestions"
```

---

### Task 3: Initialize Coloris in preferences-page.ts

**Files:**
- Modify: `src/preferences-page.ts:1-5` (imports)
- Modify: `src/preferences-page.ts:53-56` (init function, after config load)

- [ ] **Step 1: Add Coloris imports at the top of preferences-page.ts**

Add these two lines after the existing imports (line 4):

```typescript
import "@melloware/coloris/dist/coloris.css";
import Coloris from "@melloware/coloris";
```

- [ ] **Step 2: Initialize Coloris in the init() function**

After `applyAccent(config.theme.accentColor);` (line 56), add:

```typescript
  Coloris.init();
  Coloris({
    el: "[data-coloris]",
    theme: "default",
    themeMode: "dark",
    wrap: true,
    alpha: false,
    format: "hex",
    formatToggle: false,
    swatches: [],
  });
```

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: initialize Coloris color picker in preferences"
```

---

### Task 4: Replace theme color inputs (Background & Accent)

**Files:**
- Modify: `src/preferences-page.ts:245` (bg color input in renderAppearancePage)
- Modify: `src/preferences-page.ts:273` (accent color input in renderAppearancePage)
- Modify: `src/preferences-page.ts:610-611` (bindColor helper)

- [ ] **Step 1: Replace the background color input**

In `renderAppearancePage`, change line 245 from:

```typescript
          <input type="color" class="prefs-color" id="pref-bg-color" value="${config.theme.backgroundColor}">
```

to:

```typescript
          <input type="text" data-coloris id="pref-bg-color" class="prefs-color" value="${config.theme.backgroundColor}">
```

- [ ] **Step 2: Replace the accent color input**

In `renderAppearancePage`, change line 273 from:

```typescript
          <input type="color" class="prefs-color" id="pref-accent-color" value="${config.theme.accentColor}">
```

to:

```typescript
          <input type="text" data-coloris id="pref-accent-color" class="prefs-color" value="${config.theme.accentColor}">
```

- [ ] **Step 3: Update the bindColor helper to work with text inputs**

The `bindColor` function at line 610 already listens to `input` events and reads `.value`, which works the same for Coloris text inputs. No change needed — Coloris fires standard `input` events on the bound element.

- [ ] **Step 4: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: replace theme color inputs with Coloris pickers"
```

---

### Task 5: Replace state color inputs and wire up suggestions

**Files:**
- Modify: `src/preferences-page.ts:1-6` (add color-utils import)
- Modify: `src/preferences-page.ts:450-549` (renderStateSlots function)

- [ ] **Step 1: Add the color-utils import**

Add after the existing imports at the top of the file:

```typescript
import { generateSuggestions } from "./color-utils";
```

- [ ] **Step 2: Create a helper to collect all state colors except one**

Add this function before `renderStateSlots`:

```typescript
function collectOtherStateColors(config: Config, excludeState: string): string[] {
  const colors: string[] = [];
  for (const { key } of STATE_ENTRIES) {
    if (key === excludeState) continue;
    const sc = config.states[key];
    if (sc?.iconColor) colors.push(sc.iconColor);
    if (sc?.dotColor) colors.push(sc.dotColor);
  }
  // Include defaults for states without custom colors
  for (const { key } of STATE_ENTRIES) {
    if (key === excludeState) continue;
    if (!config.states[key]?.iconColor && DEFAULT_ICON_COLORS[key]) colors.push(DEFAULT_ICON_COLORS[key]);
    if (!config.states[key]?.dotColor && DEFAULT_DOT_COLORS[key]) colors.push(DEFAULT_DOT_COLORS[key]);
  }
  return [...new Set(colors)];
}
```

- [ ] **Step 3: Replace color inputs in renderStateSlots HTML**

In `renderStateSlots`, replace the two `<input type="color">` lines (466 and 468):

From:

```typescript
        <input type="color" class="state-slot-color" data-action="icon-color" value="${iconColor || DEFAULT_ICON_COLORS[key] || config.theme.accentColor}" title="Icon color">
```

To:

```typescript
        <input type="text" data-coloris class="state-slot-color" data-action="icon-color" data-state-key="${key}" value="${iconColor || DEFAULT_ICON_COLORS[key] || config.theme.accentColor}" title="Icon color">
```

From:

```typescript
        <input type="color" class="state-slot-color" data-action="dot-color" value="${dotColor || DEFAULT_DOT_COLORS[key] || config.theme.accentColor}" title="Dot color">
```

To:

```typescript
        <input type="text" data-coloris class="state-slot-color" data-action="dot-color" data-state-key="${key}" value="${dotColor || DEFAULT_DOT_COLORS[key] || config.theme.accentColor}" title="Dot color">
```

- [ ] **Step 4: Wire up dynamic swatch updates using Coloris.setInstance**

After the container HTML is set (after `container.innerHTML = ...` and before `container.onclick`), add:

```typescript
  // Configure per-state Coloris instances with palette-aware suggestions
  function updateSwatches(): void {
    for (const { key } of STATE_ENTRIES) {
      const otherColors = collectOtherStateColors(config, key);
      const swatches = generateSuggestions(otherColors);
      Coloris.setInstance(`[data-state-key="${key}"]`, { swatches });
    }
  }
  updateSwatches();
```

- [ ] **Step 5: Update the color input change handler to refresh swatches**

Replace the existing color input change handler block (lines 534-549) with:

```typescript
  // Color change handler — Coloris fires input/change on the bound text input
  container.querySelectorAll<HTMLInputElement>(".state-slot-color").forEach((input) => {
    input.addEventListener("input", async () => {
      const slot = input.closest(".state-slot") as HTMLElement;
      const state = slot.dataset.state!;
      if (!config.states[state]) config.states[state] = {};
      const action = input.dataset.action;
      if (action === "icon-color") {
        config.states[state].iconColor = input.value;
      } else if (action === "dot-color") {
        config.states[state].dotColor = input.value;
      }
      await save();
      updateSwatches();
    });
    input.addEventListener("change", () => renderStateSlots(config, save));
  });
```

- [ ] **Step 6: Verify the app builds**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/preferences-page.ts
git commit -m "feat: replace state color inputs with Coloris and add palette-aware suggestions"
```

---

### Task 6: Style Coloris dark theme to match the app

**Files:**
- Modify: `src/preferences-page.css` (append Coloris overrides)

- [ ] **Step 1: Add Coloris dark theme overrides at the end of preferences-page.css**

```css
/* ── Coloris overrides ─────────────────────────────── */

.clr-picker {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.clr-picker .clr-gradient {
  border-radius: 4px;
}

.clr-picker .clr-hue,
.clr-picker .clr-alpha {
  border-radius: 2px;
}

.clr-picker input.clr-color {
  background: #0e1117;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 4px;
  font-size: 12px;
}

.clr-picker input.clr-color:focus {
  border-color: var(--accent);
}

.clr-swatches button {
  border-radius: 50%;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.clr-swatches button:hover {
  border-color: var(--accent);
}

.clr-swatches div::before {
  content: "Suggested";
  display: block;
  font-size: 10px;
  color: #6e7681;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
```

- [ ] **Step 2: Update the swatch input styling**

The `.state-slot-color` and `.prefs-color` classes currently style `<input type="color">` with `::-webkit-color-swatch` pseudo-elements. Replace the state-slot-color block:

From:

```css
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
```

To:

```css
.state-slot-color {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  font-size: 0;
  caret-color: transparent;
}
```

- [ ] **Step 3: Update the prefs-color styling**

Replace the `.prefs-color` block:

From:

```css
.prefs-color {
  width: 32px;
  height: 32px;
  border: 2px solid #30363d;
  border-radius: 6px;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
}

.prefs-color::-webkit-color-swatch-wrapper {
  padding: 0;
}

.prefs-color::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.prefs-color:hover {
  border-color: #484f58;
}
```

To:

```css
.prefs-color {
  width: 32px;
  height: 32px;
  border: 2px solid #30363d;
  border-radius: 6px;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  font-size: 0;
  caret-color: transparent;
}

.prefs-color:hover {
  border-color: #484f58;
}
```

- [ ] **Step 4: Verify the app builds**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/preferences-page.css
git commit -m "feat: style Coloris picker to match dark theme"
```

---

### Task 7: Manual testing

- [ ] **Step 1: Run the app**

```bash
npm run tauri dev
```

- [ ] **Step 2: Verify theme color pickers**

Open Preferences > Appearance. Click the Background Color and Accent Color swatches. Verify:
- Coloris popover appears anchored to the swatch (not an OS dialog)
- Dark theme matches the app
- Color changes apply immediately

- [ ] **Step 3: Verify state color pickers with suggestions**

Open Preferences > States. Click any icon or dot color swatch. Verify:
- Coloris popover appears with suggested colors at the bottom
- Suggested colors are labeled "Suggested"
- Changing one state's color and opening another state's picker shows updated suggestions
- Reset buttons still work

- [ ] **Step 4: Commit any fixes if needed**
