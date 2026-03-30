import { Session } from "./state";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  getCurrentWindow,
  currentMonitor,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

let tooltipWindow: WebviewWindow | null = null;
let showTooltips = true;
let generation = 0;
let activeGeneration = -1;
let showTimer: number | null = null;

const SHOW_DELAY_MS = 200;

export async function initTooltip(): Promise<void> {
  tooltipWindow = await WebviewWindow.getByLabel("tooltip");

  const config = await invoke<{ showTooltips: boolean }>("get_config");
  showTooltips = config.showTooltips;

  listen<{ showTooltips: boolean }>("config-changed", (event) => {
    showTooltips = event.payload.showTooltips;
    if (!showTooltips) {
      hideTooltip();
    }
  });

  listen<{ width: number; height: number; generation: number }>(
    "tooltip:ready",
    async (event) => {
      const { width, height, generation: readyGen } = event.payload;

      // Only proceed if this ready event matches the currently active show
      if (!tooltipWindow || activeGeneration !== readyGen) return;

      const monitor = await currentMonitor();
      if (!monitor || activeGeneration !== readyGen) return;

      const monitorPos = monitor.position;
      const monitorSize = monitor.size;

      let x = lastAnchorScreenX - width / 2;
      let y = lastAnchorScreenY - height - 8;

      // Flip below if not enough space above
      if (y < monitorPos.y) {
        y = lastAnchorScreenY + lastAnchorHeight + 8;
      }

      // Clamp horizontally
      if (x < monitorPos.x + 4) {
        x = monitorPos.x + 4;
      }
      if (x + width > monitorPos.x + monitorSize.width - 4) {
        x = monitorPos.x + monitorSize.width - width - 4;
      }

      // Clamp bottom
      if (y + height > monitorPos.y + monitorSize.height - 4) {
        y = monitorPos.y + monitorSize.height - height - 4;
      }

      if (activeGeneration !== readyGen) return;

      await tooltipWindow.setSize(new PhysicalSize(width, height));
      await tooltipWindow.setPosition(new PhysicalPosition(x, y));
      await tooltipWindow.show();
    },
  );
}

let lastAnchorScreenX = 0;
let lastAnchorScreenY = 0;
let lastAnchorHeight = 0;

export function showTooltip(session: Session, anchor: HTMLElement): void {
  if (!showTooltips || !tooltipWindow) return;

  // Cancel any pending show
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }

  // Bump generation immediately so any in-flight ready events are stale
  generation++;
  const thisGen = generation;

  showTimer = window.setTimeout(() => {
    showTimer = null;
    // If a hide happened while we were waiting, abort
    if (activeGeneration === -1 && generation !== thisGen) return;

    activeGeneration = thisGen;
    doShowTooltip(session, anchor, thisGen);
  }, SHOW_DELAY_MS);
}

async function doShowTooltip(
  session: Session,
  anchor: HTMLElement,
  gen: number,
): Promise<void> {
  if (!tooltipWindow || activeGeneration !== gen) return;

  const mainPos = await getCurrentWindow().outerPosition();
  if (activeGeneration !== gen) return;

  const rect = anchor.getBoundingClientRect();
  const monitor = await currentMonitor();
  if (activeGeneration !== gen) return;

  const scaleFactor = monitor?.scaleFactor ?? 1;

  lastAnchorScreenX = mainPos.x + (rect.left + rect.width / 2) * scaleFactor;
  lastAnchorScreenY = mainPos.y + rect.top * scaleFactor;
  lastAnchorHeight = rect.height * scaleFactor;

  await emit("tooltip:show", {
    generation: gen,
    sessionId: session.sessionId,
    agent: session.agent,
    state: session.state,
    registeredAt: session.registeredAt,
  });
}

export function hideTooltip(): void {
  // Cancel any pending debounced show
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }

  generation++;
  activeGeneration = -1;

  if (!tooltipWindow) return;

  // Fire-and-forget: hide immediately, no awaiting
  emit("tooltip:hide");
  tooltipWindow.hide();
}
