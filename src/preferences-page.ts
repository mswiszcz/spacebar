import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

interface Config {
  orientation: string;
  alwaysOnTop: boolean;
  mascotSize: string;
  showLabels: boolean;
  showTooltips: boolean;
  position: { x: number; y: number };
  sound: { enabled: boolean; volume: number };
  theme: {
    backgroundColor: string;
    backgroundOpacity: number;
    vibrancyMaterial: string;
    accentColor: string;
  };
}

async function init(): Promise<void> {
  const config = await invoke<Config>("get_config");
  const root = document.getElementById("prefs-root")!;

  root.innerHTML = `
    <h2>Preferences</h2>

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
        <label>Vibrancy</label>
        <select id="pref-vibrancy">
          <option value="None" ${config.theme.vibrancyMaterial === "None" ? "selected" : ""}>None</option>
          <option value="HudWindow" ${config.theme.vibrancyMaterial === "HudWindow" ? "selected" : ""}>HUD Window</option>
          <option value="Menu" ${config.theme.vibrancyMaterial === "Menu" ? "selected" : ""}>Menu</option>
          <option value="Popover" ${config.theme.vibrancyMaterial === "Popover" ? "selected" : ""}>Popover</option>
          <option value="Sidebar" ${config.theme.vibrancyMaterial === "Sidebar" ? "selected" : ""}>Sidebar</option>
          <option value="Sheet" ${config.theme.vibrancyMaterial === "Sheet" ? "selected" : ""}>Sheet</option>
          <option value="WindowBackground" ${config.theme.vibrancyMaterial === "WindowBackground" ? "selected" : ""}>Window</option>
          <option value="ContentBackground" ${config.theme.vibrancyMaterial === "ContentBackground" ? "selected" : ""}>Content</option>
          <option value="UnderWindowBackground" ${config.theme.vibrancyMaterial === "UnderWindowBackground" ? "selected" : ""}>Under Window</option>
          <option value="Tooltip" ${config.theme.vibrancyMaterial === "Tooltip" ? "selected" : ""}>Tooltip</option>
          <option value="Titlebar" ${config.theme.vibrancyMaterial === "Titlebar" ? "selected" : ""}>Titlebar</option>
          <option value="HeaderView" ${config.theme.vibrancyMaterial === "HeaderView" ? "selected" : ""}>Header</option>
          <option value="Selection" ${config.theme.vibrancyMaterial === "Selection" ? "selected" : ""}>Selection</option>
          <option value="FullScreenUI" ${config.theme.vibrancyMaterial === "FullScreenUI" ? "selected" : ""}>Full Screen</option>
          <option value="UnderPageBackground" ${config.theme.vibrancyMaterial === "UnderPageBackground" ? "selected" : ""}>Under Page</option>
        </select>
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

  const save = async () => {
    await invoke("save_config", { config });
    await emit("config-changed", config);
  };

  // Bind all controls
  bindSelect("#pref-orientation", (v) => { config.orientation = v; save(); });
  bindSelect("#pref-mascot-size", (v) => { config.mascotSize = v; save(); });
  bindCheckbox("#pref-show-labels", (v) => { config.showLabels = v; save(); });
  bindCheckbox("#pref-show-tooltips", (v) => { config.showTooltips = v; save(); });
  bindColor("#pref-bg-color", (v) => { config.theme.backgroundColor = v; save(); });
  bindRange("#pref-bg-opacity", (v) => { config.theme.backgroundOpacity = v / 100; save(); });
  bindSelect("#pref-vibrancy", (v) => { config.theme.vibrancyMaterial = v; save(); });
  bindColor("#pref-accent-color", (v) => { config.theme.accentColor = v; save(); });
  bindCheckbox("#pref-sound-enabled", (v) => { config.sound.enabled = v; save(); });
  bindRange("#pref-sound-volume", (v) => { config.sound.volume = v / 100; save(); });
  bindCheckbox("#pref-always-on-top", async (v) => {
    config.alwaysOnTop = v;
    // Apply to the main window, not this one
    await invoke("set_main_always_on_top", { alwaysOnTop: v });
    save();
  });
}

function bindSelect(selector: string, cb: (v: string) => void): void {
  document.querySelector(selector)?.addEventListener("change", (e) => cb((e.target as HTMLSelectElement).value));
}

function bindCheckbox(selector: string, cb: (v: boolean) => void): void {
  document.querySelector(selector)?.addEventListener("change", (e) => cb((e.target as HTMLInputElement).checked));
}

function bindColor(selector: string, cb: (v: string) => void): void {
  document.querySelector(selector)?.addEventListener("input", (e) => cb((e.target as HTMLInputElement).value));
}

function bindRange(selector: string, cb: (v: number) => void): void {
  document.querySelector(selector)?.addEventListener("input", (e) => cb(Number((e.target as HTMLInputElement).value)));
}

init();
