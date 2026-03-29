import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import type { Config } from "./main";

let prefsWindow: WebviewWindow | null = null;

export function initPreferences(onChange: (config: Config) => void): void {
  // Listen for config changes from the preferences window
  listen<Config>("config-changed", (event) => {
    onChange(event.payload);
  });

  document.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    await openPreferences();
  });
}

async function openPreferences(): Promise<void> {
  // If already open, focus it
  if (prefsWindow) {
    try {
      await prefsWindow.setFocus();
      return;
    } catch {
      // Window was closed, create a new one
      prefsWindow = null;
    }
  }

  prefsWindow = new WebviewWindow("preferences", {
    url: "preferences.html",
    title: "Preferences",
    width: 320,
    height: 480,
    resizable: false,
    center: true,
  });

  prefsWindow.once("tauri://destroyed", () => {
    prefsWindow = null;
  });
}
