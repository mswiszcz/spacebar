import { MascotDefinition, IconDefinition } from "./types";
import { claudeCode } from "./claude-code";
import { cursor } from "./cursor";

const FALLBACK_ICON: IconDefinition = {
  svg: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 17.5v-11A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5zm3-8.5v2h2V9H7zm8 0v2h2V9h-2zm-6 4v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V13H9z"/>
  </svg>`,
};

const mascots: Record<string, MascotDefinition> = {
  "claude-code": claudeCode,
  cursor,
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
