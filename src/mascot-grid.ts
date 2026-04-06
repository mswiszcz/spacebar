import { Session, Group, sessionState } from "./state";
import { getMascot, getAllMascotCSS, getMascotIcon } from "./mascots/registry";
import { MascotState } from "./mascots/types";
import { invoke } from "@tauri-apps/api/core";
import { playStateSound } from "./sound";
import { showTooltip, hideTooltip } from "./tooltip";

const SLEEP_DELAY_MS = 30_000;
const sleepTimers = new Map<string, number>();
const silentUpdates = new Set<string>();
const lastKnownState = new Map<string, string>();
let displayModes: Record<string, string> = {};
let statusDotCorner = "top-left";

export function updateDisplayConfig(modes: Record<string, string>, corner: string): void {
  const changed = JSON.stringify(displayModes) !== JSON.stringify(modes) || statusDotCorner !== corner;
  displayModes = modes;
  statusDotCorner = corner;
  if (changed) rebuildAllSessions();
}

function rebuildAllSessions(): void {
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;
  // Clear tracked state so sessions get fully recreated
  lastKnownState.clear();
  sleepTimers.forEach((timer) => clearTimeout(timer));
  sleepTimers.clear();
  // Remove all session elements (groups stay, sessions get re-added by renderGroups)
  grid.querySelectorAll(".mascot-item").forEach((el) => el.remove());
  grid.querySelectorAll(".entity-separator").forEach((el) => el.remove());
  renderGroups(grid);
}

export function markSilentUpdate(sessionId: string): void {
  silentUpdates.add(sessionId);
}

export function initMascotGrid(container: HTMLElement): void {
  const style = document.createElement("style");
  style.textContent = getAllMascotCSS();
  document.head.appendChild(style);

  const grid = document.createElement("div");
  grid.className = "mascot-grid";
  container.appendChild(grid);

  sessionState.subscribe(() => renderGroups(grid));
  sessionState.subscribeGroups(() => renderGroups(grid));
}

function renderGroups(grid: HTMLElement): void {
  const groups = sessionState.getAllGroups();
  const currentGroupIds = new Set(groups.map((g) => g.groupId));

  // Remove departed groups
  Array.from(grid.querySelectorAll(".mascot-group")).forEach((el) => {
    const gid = (el as HTMLElement).dataset.groupId;
    if (gid && !currentGroupIds.has(gid)) {
      el.remove();
    }
  });

  // Add or update groups
  for (const group of groups) {
    // Skip groups with no live sessions (defensive: backend may have
    // already removed the group but the frontend state is stale)
    const groupSessions = group.sessionIds
      .map((sid) => sessionState.get(sid))
      .filter(Boolean) as Session[];

    let groupEl = grid.querySelector(
      `[data-group-id="${group.groupId}"]`
    ) as HTMLElement | null;

    if (groupSessions.length === 0) {
      if (groupEl) groupEl.remove();
      continue;
    }

    if (!groupEl) {
      groupEl = createGroupElement(group);
      grid.appendChild(groupEl);
    } else {
      updateGroupLabel(groupEl, group);
    }

    const mascotContainer = groupEl.querySelector(
      ".group-mascots"
    ) as HTMLElement;
    renderSessionsInGroup(mascotContainer, groupSessions);
  }
}

function createGroupElement(group: Group): HTMLElement {
  const container = document.createElement("div");
  container.className =
    group.groupId === "anonymous" ? "mascot-group anonymous" : "mascot-group";
  container.dataset.groupId = group.groupId;

  const label = document.createElement("div");
  label.className = "group-label";
  label.textContent = group.displayName ?? "";
  container.appendChild(label);

  if (group.groupId !== "anonymous") {
    label.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      startInlineRename(label, group);
    });
  }

  const mascots = document.createElement("div");
  mascots.className = "group-mascots";
  container.appendChild(mascots);

  return container;
}

function updateGroupLabel(groupEl: HTMLElement, group: Group): void {
  const label = groupEl.querySelector(".group-label");
  if (label && !label.querySelector("input")) {
    label.textContent = group.displayName ?? "";
  }
}

function startInlineRename(label: HTMLElement, group: Group): void {
  const currentText = label.textContent ?? "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "group-rename-input";
  input.value = currentText;

  label.textContent = "";
  label.appendChild(input);
  input.focus();
  input.select();

  const confirm = () => {
    const newName = input.value.trim();
    if (newName && newName !== currentText) {
      invoke("rename_group", {
        groupId: group.groupId,
        displayName: newName,
      });
    }
    label.textContent = newName || currentText;
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    } else if (e.key === "Escape") {
      label.textContent = currentText;
    }
  });

  input.addEventListener("blur", confirm);
}

function renderSessionsInGroup(
  container: HTMLElement,
  sessions: Session[]
): void {
  const currentIds = new Set(sessions.map((s) => s.sessionId));

  // Remove departed
  Array.from(container.children).forEach((el) => {
    const id = (el as HTMLElement).dataset.sessionId;
    if (id && !currentIds.has(id)) {
      clearSleepTimer(id);
      lastKnownState.delete(id);
      el.remove();
    }
  });

  // Add or update
  sessions.forEach((session) => {
    let el = container.querySelector(
      `[data-session-id="${session.sessionId}"]`
    ) as HTMLElement | null;

    if (!el) {
      el = createMascotElement(session);
      container.appendChild(el);
    } else {
      updateMascotElement(el, session);
    }
  });

  // Rebuild separators
  container.querySelectorAll(".entity-separator").forEach((s) => s.remove());
  const items = Array.from(container.querySelectorAll(".mascot-item"));
  for (let i = 1; i < items.length; i++) {
    const sep = document.createElement("div");
    sep.className = "entity-separator";
    container.insertBefore(sep, items[i]);
  }
}

function createMascotElement(session: Session): HTMLElement {
  const wrapper = document.createElement("div");
  const isIcon = displayModes[session.agent] === "icon";
  wrapper.className = `mascot-item state-idle${isIcon ? " icon-mode" : ""}`;
  wrapper.dataset.sessionId = session.sessionId;

  if (isIcon) {
    const iconDef = getMascotIcon(session.agent);
    const iconWrapper = document.createElement("div");
    iconWrapper.className = "icon-wrapper";
    iconWrapper.innerHTML = iconDef.svg;

    const dot = document.createElement("div");
    dot.className = `status-dot dot-${statusDotCorner}`;

    wrapper.appendChild(iconWrapper);
    wrapper.appendChild(dot);
  } else {
    const mascotWrapper = document.createElement("div");
    mascotWrapper.className = "mascot-wrapper";
    const mascot = getMascot(session.agent);
    mascotWrapper.innerHTML = mascot.svg("idle" as MascotState);
    wrapper.appendChild(mascotWrapper);
  }

  const label = document.createElement("div");
  label.className = "mascot-label";
  label.textContent = session.state;
  wrapper.appendChild(label);

  lastKnownState.set(session.sessionId, session.state);
  if (session.state === "idle") {
    startSleepTimer(wrapper, session);
  }

  wrapper.addEventListener("click", () => {
    invoke("execute_click", { sessionId: session.sessionId });
  });

  wrapper.addEventListener("mouseenter", () => {
    const currentSession = sessionState.get(session.sessionId);
    if (currentSession) {
      showTooltip(currentSession, wrapper);
    }
  });
  wrapper.addEventListener("mouseleave", () => {
    hideTooltip();
  });

  return wrapper;
}

function clearSleepTimer(sessionId: string): void {
  const timer = sleepTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    sleepTimers.delete(sessionId);
  }
}

function startSleepTimer(el: HTMLElement, session: Session): void {
  clearSleepTimer(session.sessionId);
  const timer = window.setTimeout(() => {
    sleepTimers.delete(session.sessionId);
    updateMascotElement(el, { ...session, state: "sleeping" });
  }, SLEEP_DELAY_MS);
  sleepTimers.set(session.sessionId, timer);
}

function updateMascotElement(el: HTMLElement, session: Session): void {
  const state = session.state as MascotState;
  const prev = lastKnownState.get(session.sessionId);
  if (prev === state) return;
  if (prev === "sleeping" && state === "idle") return;
  lastKnownState.set(session.sessionId, state);

  const silent = silentUpdates.has(session.sessionId);
  silentUpdates.delete(session.sessionId);
  playStateSound(state, silent);

  const isIcon = el.classList.contains("icon-mode");
  el.className = `mascot-item state-${state}${isIcon ? " icon-mode" : ""}`;
  el.dataset.sessionId = session.sessionId;

  if (isIcon) {
    const dot = el.querySelector(".status-dot") as HTMLElement;
    if (dot) {
      dot.className = `status-dot dot-${statusDotCorner}`;
      const dotStates = ["thinking", "needs-input", "error", "compacting", "notification"];
      if (dotStates.includes(state)) {
        dot.classList.add(`dot-${state}`);
      }
    }
  } else {
    const mascot = getMascot(session.agent);
    const wrapper = el.querySelector(".mascot-wrapper");
    if (wrapper) {
      wrapper.innerHTML = mascot.svg(state);
    }
  }

  const label = el.querySelector(".mascot-label");
  if (label) {
    label.textContent = state;
  }

  clearSleepTimer(session.sessionId);
  if (state === "idle") {
    startSleepTimer(el, session);
  }
}

export function triggerExit(
  container: HTMLElement,
  sessionId: string
): Promise<void> {
  return new Promise((resolve) => {
    const el = container.querySelector(
      `[data-session-id="${sessionId}"]`
    ) as HTMLElement | null;

    if (el) {
      playStateSound("exiting");
      const isIcon = el.classList.contains("icon-mode");
      el.className = `mascot-item state-exiting${isIcon ? " icon-mode" : ""}`;
      if (!isIcon) {
        const mascot = getMascot("claude-code");
        const wrapper = el.querySelector(".mascot-wrapper");
        if (wrapper) {
          wrapper.innerHTML = mascot.svg("exiting");
        }
      }
      setTimeout(() => {
        el.remove();
        resolve();
      }, 400);
    } else {
      resolve();
    }
  });
}
