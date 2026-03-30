import { Session, Group, sessionState } from "./state";
import { getMascot, getAllMascotCSS } from "./mascots/registry";
import { MascotState } from "./mascots/types";
import { invoke } from "@tauri-apps/api/core";
import { playStateSound } from "./sound";
import { showTooltip, hideTooltip } from "./tooltip";

const SLEEP_DELAY_MS = 30_000;
const sleepTimers = new Map<string, number>();

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
    let groupEl = grid.querySelector(
      `[data-group-id="${group.groupId}"]`
    ) as HTMLElement | null;

    if (!groupEl) {
      groupEl = createGroupElement(group);
      grid.appendChild(groupEl);
    } else {
      updateGroupLabel(groupEl, group);
    }

    const mascotContainer = groupEl.querySelector(
      ".group-mascots"
    ) as HTMLElement;
    const groupSessions = group.sessionIds
      .map((sid) => sessionState.get(sid))
      .filter(Boolean) as Session[];
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
}

function createMascotElement(session: Session): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = `mascot-item state-idle`;
  wrapper.dataset.sessionId = session.sessionId;

  const mascotWrapper = document.createElement("div");
  mascotWrapper.className = "mascot-wrapper";

  const mascot = getMascot(session.agent);
  mascotWrapper.innerHTML = mascot.svg("idle" as MascotState);

  const label = document.createElement("div");
  label.className = "mascot-label";
  label.textContent = session.state;

  wrapper.appendChild(mascotWrapper);
  wrapper.appendChild(label);

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
  const mascot = getMascot(session.agent);

  playStateSound(state);

  el.className = `mascot-item state-${state}`;
  el.dataset.sessionId = session.sessionId;

  const wrapper = el.querySelector(".mascot-wrapper");
  if (wrapper) {
    wrapper.innerHTML = mascot.svg(state);
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
      el.className = "mascot-item state-exiting";
      const mascot = getMascot("claude-code");
      const wrapper = el.querySelector(".mascot-wrapper");
      if (wrapper) {
        wrapper.innerHTML = mascot.svg("exiting");
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
