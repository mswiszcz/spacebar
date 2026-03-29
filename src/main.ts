import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Session, sessionState } from "./state";
import { initMascotGrid, triggerExit } from "./mascot-grid";

async function init(): Promise<void> {
  const app = document.getElementById("app")!;
  initMascotGrid(app);

  // Load existing sessions (in case frontend reloads)
  const existing = await invoke<Session[]>("get_sessions");
  existing.forEach((s) => sessionState.add(s));

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
}

init();
