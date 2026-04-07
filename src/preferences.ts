import { listen } from "@tauri-apps/api/event";
import type { Config } from "./main";

export function initPreferences(onChange: (config: Config) => void): void {
  listen<Config>("config-changed", (event) => {
    onChange(event.payload);
  });
}
