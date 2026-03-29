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

  listen<{ width: number; height: number }>("tooltip:ready", async (event) => {
    const currentGen = generation;
    if (!tooltipWindow) return;

    const { width, height } = event.payload;
    const monitor = await currentMonitor();
    if (!monitor || currentGen !== generation) return;

    const monitorPos = monitor.position;
    const monitorSize = monitor.size;

    // Retrieve stored anchor from the module-level variable
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

    if (currentGen !== generation) return;

    await tooltipWindow.setSize(new PhysicalSize(width, height));
    await tooltipWindow.setPosition(new PhysicalPosition(x, y));
    await tooltipWindow.show();
  });
}

let lastAnchorScreenX = 0;
let lastAnchorScreenY = 0;
let lastAnchorHeight = 0;

export async function showTooltip(
  session: Session,
  anchor: HTMLElement,
): Promise<void> {
  if (!showTooltips || !tooltipWindow) return;

  generation++;

  const mainPos = await getCurrentWindow().outerPosition();
  const rect = anchor.getBoundingClientRect();
  const monitor = await currentMonitor();
  const scaleFactor = monitor?.scaleFactor ?? 1;

  lastAnchorScreenX = mainPos.x + (rect.left + rect.width / 2) * scaleFactor;
  lastAnchorScreenY = mainPos.y + rect.top * scaleFactor;
  lastAnchorHeight = rect.height * scaleFactor;

  await emit("tooltip:show", {
    sessionId: session.sessionId,
    agent: session.agent,
    state: session.state,
    registeredAt: session.registeredAt,
    anchorScreenX: lastAnchorScreenX,
    anchorScreenY: lastAnchorScreenY,
    anchorHeight: lastAnchorHeight,
  });
}

export async function hideTooltip(): Promise<void> {
  generation++;
  if (!tooltipWindow) return;
  await emit("tooltip:hide");
  await tooltipWindow.hide();
}
