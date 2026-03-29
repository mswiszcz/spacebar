import { Session, sessionState } from "./state";
import { getMascot, getAllMascotCSS } from "./mascots/registry";
import { MascotState } from "./mascots/types";
import { invoke } from "@tauri-apps/api/core";
import { playStateSound } from "./sound";
import { showTooltip, hideTooltip } from "./tooltip";

const SLEEP_DELAY_MS = 30_000;
const sleepTimers = new Map<string, number>();

export function initMascotGrid(container: HTMLElement): void {
  // Inject mascot CSS
  const style = document.createElement("style");
  style.textContent = getAllMascotCSS();
  document.head.appendChild(style);

  const grid = document.createElement("div");
  grid.className = "mascot-grid";
  container.appendChild(grid);

  sessionState.subscribe((sessions) => render(grid, sessions));
}

function render(grid: HTMLElement, sessions: Session[]): void {
  const currentIds = new Set(sessions.map((s) => s.sessionId));

  // Remove departed sessions
  Array.from(grid.children).forEach((el) => {
    const id = (el as HTMLElement).dataset.sessionId;
    if (id && !currentIds.has(id)) {
      clearSleepTimer(id);
      el.remove();
    }
  });

  // Add or update sessions
  sessions.forEach((session) => {
    let el = grid.querySelector(
      `[data-session-id="${session.sessionId}"]`
    ) as HTMLElement | null;

    if (!el) {
      el = createMascotElement(session);
      grid.appendChild(el);
    } else {
      updateMascotElement(el, session);
    }
  });
}

function createMascotElement(session: Session): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = `mascot-item state-entering`;
  wrapper.dataset.sessionId = session.sessionId;

  const mascotWrapper = document.createElement("div");
  mascotWrapper.className = "mascot-wrapper";

  const mascot = getMascot(session.agent);
  mascotWrapper.innerHTML = mascot.svg("entering" as MascotState);

  const label = document.createElement("div");
  label.className = "mascot-label";
  label.textContent = session.state;

  wrapper.appendChild(mascotWrapper);
  wrapper.appendChild(label);

  playStateSound("entering");

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

  // Transition to idle after entrance animation if no state update arrived
  setTimeout(() => {
    const current = sessionState.get(session.sessionId);
    if (current && current.state === "entering") {
      current.state = "idle";
      updateMascotElement(wrapper, current);
    }
  }, 450);

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

  // Remove all state classes, add current
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

  // Start sleep timer when idle, clear on any other state
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
