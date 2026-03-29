import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { Session, sessionState } from "./state";
import { initMascotGrid, triggerExit } from "./mascot-grid";
import { initSound } from "./sound";

interface Config {
  orientation: string;
  alwaysOnTop: boolean;
  mascotSize: string;
  showLabels: boolean;
  showTooltips: boolean;
  position: { x: number; y: number };
  sound: { enabled: boolean; volume: number };
  theme: {
    backgroundColor: string;
    backgroundOpacity: number;
    blurRadius: number;
    borderRadius: number;
    borderColor: string;
    accentColor: string;
  };
}

function applyConfig(config: Config): void {
  const app = document.getElementById("app")!;
  const grid = app.querySelector(".mascot-grid") as HTMLElement;

  // Apply orientation
  if (grid) {
    grid.classList.toggle("vertical", config.orientation === "vertical");
  }

  // Apply theme as CSS custom properties
  const root = document.documentElement;
  root.style.setProperty("--bg-color", config.theme.backgroundColor);
  root.style.setProperty("--bg-opacity", String(config.theme.backgroundOpacity));
  root.style.setProperty("--blur-radius", `${config.theme.blurRadius}px`);
  root.style.setProperty("--border-radius", `${config.theme.borderRadius}px`);
  root.style.setProperty("--border-color", config.theme.borderColor);
  root.style.setProperty("--accent-color", config.theme.accentColor);

  // Apply size class
  app.className = `size-${config.mascotSize}`;

  // Apply label visibility
  document.querySelectorAll(".mascot-label").forEach((el) => {
    (el as HTMLElement).style.display = config.showLabels ? "block" : "none";
  });
}

async function resizeWindow(): Promise<void> {
  const config = await invoke<Config>("get_config");
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;

  const count = grid.children.length;
  if (count === 0) return;

  const sizeMap: Record<string, number> = {
    small: 32,
    medium: 48,
    large: 64,
  };
  const mascotSize = sizeMap[config.mascotSize] ?? 48;
  const labelHeight = config.showLabels ? 14 : 0;
  const gap = 8;
  const padding = 16;

  const appWindow = getCurrentWindow();

  if (config.orientation === "horizontal") {
    const width = count * mascotSize + (count - 1) * gap + padding * 2;
    const height = mascotSize + labelHeight + padding * 2;
    await appWindow.setSize(new LogicalSize(width, height));
  } else {
    const width = mascotSize + padding * 2;
    const height = count * (mascotSize + labelHeight) + (count - 1) * gap + padding * 2;
    await appWindow.setSize(new LogicalSize(width, height));
  }
}

async function init(): Promise<void> {
  const app = document.getElementById("app")!;
  await initSound();
  initMascotGrid(app);

  // Load and apply initial config
  const config = await invoke<Config>("get_config");
  applyConfig(config);

  // Load existing sessions (in case frontend reloads)
  const existing = await invoke<Session[]>("get_sessions");
  existing.forEach((s) => sessionState.add(s));

  // Resize on session changes
  sessionState.subscribe(() => {
    resizeWindow();
  });

  if (existing.length > 0) {
    resizeWindow();
  }

  // Listen for backend events
  await listen<Session>("session-added", (event) => {
    sessionState.add(event.payload);
  });

  await listen<Session>("session-updated", (event) => {
    sessionState.update(event.payload);
  });

  await listen<Session>("session-removed", (event) => {
    const grid = document.querySelector(".mascot-grid") as HTMLElement;
    if (grid) {
      triggerExit(grid, event.payload.sessionId).then(() => {
        sessionState.remove(event.payload.sessionId);
      });
    }
  });

  // Save window position on move
  await listen("tauri://move", async () => {
    const appWindow = getCurrentWindow();
    const pos = await appWindow.outerPosition();
    const currentConfig = await invoke<Config>("get_config");
    currentConfig.position = { x: pos.x, y: pos.y };
    await invoke("save_config", { config: currentConfig });
  });
}

// Export for preferences to use
export { applyConfig, resizeWindow };
export type { Config };

init();
