import { listen, emit } from "@tauri-apps/api/event";

interface TooltipShowPayload {
  sessionId: string;
  agent: string;
  state: string;
  registeredAt: number;
  anchorScreenX: number;
  anchorScreenY: number;
  anchorHeight: number;
}

const tooltipRoot = document.getElementById("tooltip-root")!;

listen<TooltipShowPayload>("tooltip:show", (event) => {
  const { sessionId, agent, state, registeredAt } = event.payload;

  const uptime = Math.floor((Date.now() / 1000 - registeredAt) / 60);
  const uptimeText = uptime < 1 ? "<1m" : `${uptime}m`;

  tooltipRoot.innerHTML = `
    <div class="tooltip">
      <div class="tooltip-row"><span class="tooltip-label">Session</span> ${sessionId.slice(0, 8)}...</div>
      <div class="tooltip-row"><span class="tooltip-label">Agent</span> ${agent}</div>
      <div class="tooltip-row"><span class="tooltip-label">State</span> ${state}</div>
      <div class="tooltip-row"><span class="tooltip-label">Uptime</span> ${uptimeText}</div>
    </div>
  `;

  tooltipRoot.style.display = "block";

  const rect = tooltipRoot.getBoundingClientRect();
  emit("tooltip:ready", {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  });
});

listen("tooltip:hide", () => {
  tooltipRoot.style.display = "none";
  tooltipRoot.innerHTML = "";
});
