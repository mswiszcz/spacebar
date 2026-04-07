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
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function generateSuggestions(otherColors: string[]): string[] {
  if (otherColors.length === 0) return [];

  const suggestions: Array<{ hex: string; h: number }> = [];

  for (const hex of otherColors) {
    if (!HEX_RE.test(hex)) continue;
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
