import { MascotDefinition } from "./types";
import { claudeCode } from "./claude-code";

const mascots: Record<string, MascotDefinition> = {
  "claude-code": claudeCode,
};

export function getMascot(agent: string): MascotDefinition {
  return mascots[agent] ?? mascots["claude-code"];
}

export function getAllMascotCSS(): string {
  return Object.values(mascots)
    .map((m) => m.css)
    .join("\n");
}
