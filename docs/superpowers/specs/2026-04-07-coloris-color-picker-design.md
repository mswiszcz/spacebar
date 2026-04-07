# Coloris Color Picker with Palette-Aware Suggestions

**Date:** 2026-04-07
**Status:** Draft

## Summary

Replace native `<input type="color">` elements with @melloware/coloris, providing an inline popover color picker with dynamically generated suggested colors based on color theory and the existing palette.

## Problem

Currently, clicking a color swatch opens the OS-native color dialog in a separate window. This is disruptive — it covers the app, has no suggested colors, and doesn't match the app's dark theme.

## Solution

### 1. Coloris Integration

- Install `@melloware/coloris` as a dependency
- Initialize Coloris once in `preferences-page.ts` with dark theme settings
- Replace all `<input type="color">` with `<input type="text" data-coloris>` styled as the same swatch squares
- Applies to all 4 color input contexts: background color, accent color, per-state icon color, per-state dot color
- Coloris handles popover positioning anchored to the clicked swatch
- Theme color pickers (background, accent) use Coloris without suggestions; only state color pickers get palette-aware suggestions

### 2. Color Theory Suggestions

When the Coloris popover opens for a state color, its swatches are dynamically populated from the other configured state colors.

**Algorithm:**
- Collect all currently-set state colors (excluding the one being edited)
- For each color, generate complementary (180° hue shift) and analogous (+30°, -30° hue shift) variants in HSL
- Deduplicate colors with hue delta < 15°
- Include defaults from `state-defaults.ts` as baseline suggestions
- Cap at 12 suggested swatches

**Live updates:**
- When any color input changes, recalculate suggestions for all other pickers
- On next popover open, fresh suggestions are shown via Coloris's swatch configuration

**New file: `src/color-utils.ts`** containing pure functions:
- `hexToHsl(hex): [h, s, l]`
- `hslToHex(h, s, l): string`
- `generateSuggestions(otherColors: string[]): string[]`

### 3. UI & Styling

**Swatch inputs:** Same visual appearance as today — 24px rounded squares for state colors, 32px for theme colors. Text value hidden; only background color visible.

**Coloris theme overrides** to match the app's dark theme:
- Popover background: `#161b22`
- Borders: `#30363d`
- Text: `#c9d1d9`
- Accent/highlight: `var(--accent)`

**Suggested swatches:** Row at the bottom of the Coloris popover as small clickable circles, labeled "Suggested".

**No structural changes** to state-slot rows or preferences layout — only the input type changes.

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `@melloware/coloris` dependency |
| `src/preferences-page.ts` | Replace `<input type="color">` with Coloris inputs, init Coloris, wire up live suggestion updates |
| `src/preferences-page.css` | Coloris dark theme overrides, swatch input styling adjustments |
| `src/color-utils.ts` | New file — HSL conversion and palette-aware suggestion generation |

## Files NOT Changed

- `src/mascot-grid.ts` — color application logic unchanged
- `src/state-defaults.ts` — default colors unchanged
- Backend (Rust) — color storage unchanged
