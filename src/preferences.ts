import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { updateSoundSettings } from "./sound";
import type { Config } from "./main";

let prefsEl: HTMLElement | null = null;
let onConfigChange: ((config: Config) => void) | null = null;

export function initPreferences(onChange: (config: Config) => void): void {
  onConfigChange = onChange;

  document.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    await togglePreferences();
  });
}

async function togglePreferences(): Promise<void> {
  if (prefsEl) {
    closePreferences();
    return;
  }

  const config = await invoke<Config>("get_config");
  prefsEl = document.createElement("div");
  prefsEl.className = "preferences-popover";
  prefsEl.innerHTML = buildPrefsHTML(config);
  document.body.appendChild(prefsEl);

  // Stop drag on preferences
  prefsEl.addEventListener("mousedown", (e) => e.stopPropagation());

  bindPrefsEvents(prefsEl, config);
}

function closePreferences(): void {
  prefsEl?.remove();
  prefsEl = null;
}

function buildPrefsHTML(config: Config): string {
  return `
    <div class="prefs-header">
      <span>Preferences</span>
      <button class="prefs-close" id="prefs-close">&times;</button>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Layout</div>

      <div class="prefs-row">
        <label>Orientation</label>
        <select id="pref-orientation">
          <option value="horizontal" ${config.orientation === "horizontal" ? "selected" : ""}>Horizontal</option>
          <option value="vertical" ${config.orientation === "vertical" ? "selected" : ""}>Vertical</option>
        </select>
      </div>

      <div class="prefs-row">
        <label>Mascot Size</label>
        <select id="pref-mascot-size">
          <option value="small" ${config.mascotSize === "small" ? "selected" : ""}>Small</option>
          <option value="medium" ${config.mascotSize === "medium" ? "selected" : ""}>Medium</option>
          <option value="large" ${config.mascotSize === "large" ? "selected" : ""}>Large</option>
        </select>
      </div>

      <div class="prefs-row">
        <label>Show Labels</label>
        <input type="checkbox" id="pref-show-labels" ${config.showLabels ? "checked" : ""}>
      </div>

      <div class="prefs-row">
        <label>Show Tooltips</label>
        <input type="checkbox" id="pref-show-tooltips" ${config.showTooltips ? "checked" : ""}>
      </div>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Appearance</div>

      <div class="prefs-row">
        <label>Background</label>
        <input type="color" id="pref-bg-color" value="${config.theme.backgroundColor}">
      </div>

      <div class="prefs-row">
        <label>Opacity</label>
        <input type="range" id="pref-bg-opacity" min="0" max="100" value="${Math.round(config.theme.backgroundOpacity * 100)}">
      </div>

      <div class="prefs-row">
        <label>Blur</label>
        <input type="range" id="pref-blur" min="0" max="50" value="${config.theme.blurRadius}">
      </div>

      <div class="prefs-row">
        <label>Corner Radius</label>
        <input type="range" id="pref-border-radius" min="0" max="30" value="${config.theme.borderRadius}">
      </div>

      <div class="prefs-row">
        <label>Border Color</label>
        <input type="color" id="pref-border-color" value="${config.theme.borderColor.slice(0, 7)}">
      </div>

      <div class="prefs-row">
        <label>Accent</label>
        <input type="color" id="pref-accent-color" value="${config.theme.accentColor}">
      </div>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Sound</div>

      <div class="prefs-row">
        <label>Enabled</label>
        <input type="checkbox" id="pref-sound-enabled" ${config.sound.enabled ? "checked" : ""}>
      </div>

      <div class="prefs-row">
        <label>Volume</label>
        <input type="range" id="pref-sound-volume" min="0" max="100" value="${Math.round(config.sound.volume * 100)}">
      </div>
    </div>

    <div class="prefs-section">
      <div class="prefs-section-title">Behavior</div>

      <div class="prefs-row">
        <label>Always on Top</label>
        <input type="checkbox" id="pref-always-on-top" ${config.alwaysOnTop ? "checked" : ""}>
      </div>
    </div>
  `;
}

function bindPrefsEvents(el: HTMLElement, config: Config): void {
  const save = async () => {
    await invoke("save_config", { config });
    if (onConfigChange) onConfigChange(config);
  };

  el.querySelector("#prefs-close")?.addEventListener("click", closePreferences);

  bindSelect(el, "#pref-orientation", (v) => { config.orientation = v; save(); });
  bindSelect(el, "#pref-mascot-size", (v) => { config.mascotSize = v; save(); });
  bindCheckbox(el, "#pref-show-labels", (v) => { config.showLabels = v; save(); });
  bindCheckbox(el, "#pref-show-tooltips", (v) => { config.showTooltips = v; save(); });
  bindColor(el, "#pref-bg-color", (v) => { config.theme.backgroundColor = v; save(); });
  bindRange(el, "#pref-bg-opacity", (v) => { config.theme.backgroundOpacity = v / 100; save(); });
  bindRange(el, "#pref-blur", (v) => { config.theme.blurRadius = v; save(); });
  bindRange(el, "#pref-border-radius", (v) => { config.theme.borderRadius = v; save(); });
  bindColor(el, "#pref-border-color", (v) => { config.theme.borderColor = v; save(); });
  bindColor(el, "#pref-accent-color", (v) => { config.theme.accentColor = v; save(); });
  bindCheckbox(el, "#pref-sound-enabled", (v) => {
    config.sound.enabled = v;
    updateSoundSettings(config.sound.enabled, config.sound.volume);
    save();
  });
  bindRange(el, "#pref-sound-volume", (v) => {
    config.sound.volume = v / 100;
    updateSoundSettings(config.sound.enabled, config.sound.volume);
    save();
  });
  bindCheckbox(el, "#pref-always-on-top", async (v) => {
    config.alwaysOnTop = v;
    const appWindow = getCurrentWindow();
    await appWindow.setAlwaysOnTop(v);
    save();
  });
}

function bindSelect(el: HTMLElement, selector: string, cb: (v: string) => void): void {
  el.querySelector(selector)?.addEventListener("change", (e) => cb((e.target as HTMLSelectElement).value));
}

function bindCheckbox(el: HTMLElement, selector: string, cb: (v: boolean) => void): void {
  el.querySelector(selector)?.addEventListener("change", (e) => cb((e.target as HTMLInputElement).checked));
}

function bindColor(el: HTMLElement, selector: string, cb: (v: string) => void): void {
  el.querySelector(selector)?.addEventListener("input", (e) => cb((e.target as HTMLInputElement).value));
}

function bindRange(el: HTMLElement, selector: string, cb: (v: number) => void): void {
  el.querySelector(selector)?.addEventListener("input", (e) => cb(Number((e.target as HTMLInputElement).value)));
}
