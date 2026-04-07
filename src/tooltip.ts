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

const MAX_SIZE = new PhysicalSize(500, 200);

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

      if (!tooltipWindow || generation !== readyGen) return;

      const monitor = await currentMonitor();
      if (!monitor || generation !== readyGen) return;

      const monitorPos = monitor.position;
      const monitorSize = monitor.size;

      let x = lastAnchorScreenX - width / 2;
      let y = lastAnchorScreenY - height - 8;

      // Flip below if not enough space above
      if (y < monitorPos.y) {
        y = lastAnchorScreenY + lastAnchorHeight + 8;
      }

      // Clamp horizontally
      if (x < monitorPos.x + 4) x = monitorPos.x + 4;
      if (x + width > monitorPos.x + monitorSize.width - 4) {
        x = monitorPos.x + monitorSize.width - width - 4;
      }

      // Clamp bottom
      if (y + height > monitorPos.y + monitorSize.height - 4) {
        y = monitorPos.y + monitorSize.height - height - 4;
      }

      if (generation !== readyGen) return;

      try {
        await tooltipWindow.setSize(
          new PhysicalSize(Math.round(width), Math.round(height)),
        );
        await tooltipWindow.setPosition(
          new PhysicalPosition(Math.round(x), Math.round(y)),
        );
        await tooltipWindow.show();
      } catch {
        /* ignore positioning errors */
      }
    },
  );
}

let lastAnchorScreenX = 0;
let lastAnchorScreenY = 0;
let lastAnchorHeight = 0;

export function showTooltip(session: Session, anchor: HTMLElement): void {
  if (!showTooltips || !tooltipWindow) return;

  generation++;
  const thisGen = generation;

  doShowTooltip(session, anchor, thisGen);
}

async function doShowTooltip(
  session: Session,
  anchor: HTMLElement,
  gen: number,
): Promise<void> {
  if (!tooltipWindow || generation !== gen) return;

  // Reset to max size so content isn't constrained by a previous small size
  try {
    await tooltipWindow.setSize(MAX_SIZE);
  } catch {
    /* ignore */
  }

  if (generation !== gen) return;

  const mainPos = await getCurrentWindow().outerPosition();
  if (generation !== gen) return;

  const rect = anchor.getBoundingClientRect();
  const monitor = await currentMonitor();
  if (generation !== gen) return;

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
  generation++;

  if (!tooltipWindow) return;

  emit("tooltip:hide");
  tooltipWindow.hide().catch(() => {});
}
