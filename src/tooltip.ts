import { Session } from "./state";

let tooltipEl: HTMLElement | null = null;

export function initTooltip(): void {
  tooltipEl = document.createElement("div");
  tooltipEl.className = "tooltip";
  tooltipEl.style.display = "none";
  document.body.appendChild(tooltipEl);
}

export function showTooltip(session: Session, anchor: HTMLElement): void {
  if (!tooltipEl) return;

  const uptime = Math.floor((Date.now() / 1000 - session.registeredAt) / 60);
  const uptimeText = uptime < 1 ? "<1m" : `${uptime}m`;

  tooltipEl.innerHTML = `
    <div class="tooltip-row"><span class="tooltip-label">Session</span> ${session.sessionId.slice(0, 8)}...</div>
    <div class="tooltip-row"><span class="tooltip-label">Agent</span> ${session.agent}</div>
    <div class="tooltip-row"><span class="tooltip-label">State</span> ${session.state}</div>
    <div class="tooltip-row"><span class="tooltip-label">Uptime</span> ${uptimeText}</div>
  `;

  const rect = anchor.getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
  tooltipEl.style.top = `${rect.top - 8}px`;
  tooltipEl.style.display = "block";
}

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.style.display = "none";
  }
}
