import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { hasIcon } from "./mascots/registry";

interface Config {
  orientation: string;
  alwaysOnTop: boolean;
  mascotSize: string;
  showLabels: boolean;
  showTooltips: boolean;
  position: { x: number; y: number };
  sound: { enabled: boolean; volume: number; pack: string; overrides: Record<string, string>; muted: string[] };
  theme: {
    backgroundColor: string;
    backgroundOpacity: number;
    blurRadius: number;
    accentColor: string;
    entityGap: number;
    groupGap: number;
  };
  snap: { enabled: boolean; edgePadding: number; snappedEdge: string | null };
  splitView: { overflowBehavior: string };
  displayModes: Record<string, string>;
  statusDotCorner: string;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "layout", label: "Layout", icon: "⊞" },
  { id: "appearance", label: "Appearance", icon: "◑" },
  { id: "sound", label: "Sound", icon: "♪" },
  { id: "behavior", label: "Behavior", icon: "⚙" },
  { id: "about", label: "About", icon: "ⓘ" },
];

function applyAccent(hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.body.style.setProperty("--accent", hex);
  document.body.style.setProperty("--accent-dim", `rgba(${r}, ${g}, ${b}, 0.12)`);
}

async function init(): Promise<void> {
  const config = await invoke<Config>("get_config");
  const version = await invoke<string>("get_version");
  applyAccent(config.theme.accentColor);
  const root = document.getElementById("prefs-root")!;

  root.innerHTML = `
    <div class="prefs-layout">
      <nav class="prefs-sidebar">
        <div class="prefs-sidebar-title">Settings</div>
        ${TABS.map(t => `
          <button class="prefs-tab" data-tab="${t.id}">
            <span class="prefs-tab-icon">${t.icon}</span>
            ${t.label}
          </button>
        `).join("")}
      </nav>
      <main class="prefs-content">
        ${renderLayoutPage(config)}
        ${renderAppearancePage(config)}
        ${renderSoundPage(config)}
        ${renderBehaviorPage(config)}
        ${renderAboutPage(version)}
      </main>
    </div>
  `;

  // Tab switching
  const tabs = root.querySelectorAll<HTMLElement>(".prefs-tab");
  const pages = root.querySelectorAll<HTMLElement>(".prefs-page");
  function activateTab(id: string) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === id));
    pages.forEach(p => p.classList.toggle("active", p.dataset.page === id));
  }
  tabs.forEach(t => t.addEventListener("click", () => activateTab(t.dataset.tab!)));
  activateTab("layout");

  // Save helper
  const save = async () => {
    await invoke("save_config", { config });
    await emit("config-changed", config);
  };

  // Bind controls
  bindSelect("#pref-orientation", (v) => { config.orientation = v; save(); });
  bindSelect("#pref-mascot-size", (v) => { config.mascotSize = v; save(); });
  bindCheckbox("#pref-show-labels", (v) => { config.showLabels = v; save(); });
  bindCheckbox("#pref-show-tooltips", (v) => { config.showTooltips = v; save(); });
  bindSelect("#pref-split-overflow", (v) => {
    if (!config.splitView) config.splitView = { overflowBehavior: "scroll" };
    config.splitView.overflowBehavior = v;
    save();
  });

  renderDisplayModes(config, save);

  bindSelect("#pref-dot-corner", (v) => {
    config.statusDotCorner = v;
    save();
  });

  bindColor("#pref-bg-color", (v) => { config.theme.backgroundColor = v; save(); });
  bindRange("#pref-bg-opacity", (v) => { config.theme.backgroundOpacity = v / 100; save(); });
  bindRange("#pref-blur", (v) => { config.theme.blurRadius = v; save(); });
  bindColor("#pref-accent-color", (v) => { config.theme.accentColor = v; applyAccent(v); save(); });
  bindRangePx("#pref-entity-gap", (v) => { config.theme.entityGap = v; save(); });
  bindRangePx("#pref-group-gap", (v) => { config.theme.groupGap = v; save(); });

  bindCheckbox("#pref-sound-enabled", (v) => { config.sound.enabled = v; save(); });
  bindRange("#pref-sound-volume", (v) => { config.sound.volume = v / 100; save(); });
  bindSelect("#pref-sound-pack", (v) => { config.sound.pack = v; save(); renderSoundSlots(config, save); });
  renderSoundSlots(config, save);

  bindCheckbox("#pref-always-on-top", async (v) => {
    config.alwaysOnTop = v;
    await invoke("set_main_always_on_top", { alwaysOnTop: v });
    save();
  });

  bindCheckbox("#pref-snap-enabled", (v) => {
    config.snap.enabled = v;
    const paddingRow = document.getElementById("pref-snap-padding-row");
    if (paddingRow) paddingRow.style.display = v ? "flex" : "none";
    if (!v) config.snap.snappedEdge = null;
    save();
  });

  const snapPaddingEl = document.querySelector<HTMLInputElement>("#pref-snap-padding");
  if (snapPaddingEl) {
    const snapPaddingVal = document.getElementById("pref-snap-padding-val");
    snapPaddingEl.addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (snapPaddingVal) snapPaddingVal.textContent = v + "px";
      config.snap.edgePadding = v;
      save();
    });
  }
}

// ── Page renderers ──────────────────────────────────

function renderLayoutPage(config: Config): string {
  return `
    <div class="prefs-page" data-page="layout">
      <div class="prefs-page-title">Layout</div>

      <div class="prefs-section">
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Orientation</span>
            <span class="prefs-row-hint">Direction mascots are arranged</span>
          </div>
          <select class="prefs-select" id="pref-orientation">
            <option value="horizontal" ${config.orientation === "horizontal" ? "selected" : ""}>Horizontal</option>
            <option value="vertical" ${config.orientation === "vertical" ? "selected" : ""}>Vertical</option>
          </select>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Mascot Size</span>
            <span class="prefs-row-hint">Size of mascot avatars</span>
          </div>
          <select class="prefs-select" id="pref-mascot-size">
            <option value="small" ${config.mascotSize === "small" ? "selected" : ""}>Small</option>
            <option value="medium" ${config.mascotSize === "medium" ? "selected" : ""}>Medium</option>
            <option value="large" ${config.mascotSize === "large" ? "selected" : ""}>Large</option>
          </select>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Show Labels</span>
            <span class="prefs-row-hint">Display agent name below avatar</span>
          </div>
          ${toggleSwitch("pref-show-labels", config.showLabels)}
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Show Tooltips</span>
            <span class="prefs-row-hint">Show status tooltip on hover</span>
          </div>
          ${toggleSwitch("pref-show-tooltips", config.showTooltips)}
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Split View Overflow</span>
            <span class="prefs-row-hint">How to handle too many mascots in Split View</span>
          </div>
          <select class="prefs-select" id="pref-split-overflow">
            <option value="scroll" ${(config.splitView?.overflowBehavior ?? "scroll") === "scroll" ? "selected" : ""}>Scroll</option>
            <option value="shrink" ${config.splitView?.overflowBehavior === "shrink" ? "selected" : ""}>Auto-shrink</option>
          </select>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Display Mode</span>
            <span class="prefs-row-hint">Show mascot or icon per agent type</span>
          </div>
          <div id="pref-display-modes"></div>
        </div>

        <div class="prefs-row" id="pref-dot-corner-row" style="display: ${Object.values(config.displayModes ?? {}).includes("icon") ? "flex" : "none"}">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Status Dot Corner</span>
            <span class="prefs-row-hint">Position of status indicator on icons</span>
          </div>
          <select class="prefs-select" id="pref-dot-corner">
            <option value="top-left" ${(config.statusDotCorner ?? "top-left") === "top-left" ? "selected" : ""}>Top-Left</option>
            <option value="top-right" ${config.statusDotCorner === "top-right" ? "selected" : ""}>Top-Right</option>
            <option value="bottom-left" ${config.statusDotCorner === "bottom-left" ? "selected" : ""}>Bottom-Left</option>
            <option value="bottom-right" ${config.statusDotCorner === "bottom-right" ? "selected" : ""}>Bottom-Right</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderAppearancePage(config: Config): string {
  return `
    <div class="prefs-page" data-page="appearance">
      <div class="prefs-page-title">Appearance</div>

      <div class="prefs-section">
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Background Color</span>
          </div>
          <input type="color" class="prefs-color" id="pref-bg-color" value="${config.theme.backgroundColor}">
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Background Opacity</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-bg-opacity" min="10" max="100" value="${Math.round(config.theme.backgroundOpacity * 100)}">
            <span class="prefs-range-value" id="pref-bg-opacity-val">${Math.round(config.theme.backgroundOpacity * 100)}%</span>
          </div>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Background Blur</span>
            <span class="prefs-row-hint">Blur intensity of desktop behind window</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-blur" min="0" max="100" value="${config.theme.blurRadius}">
            <span class="prefs-range-value" id="pref-blur-val">${config.theme.blurRadius}</span>
          </div>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Accent Color</span>
          </div>
          <input type="color" class="prefs-color" id="pref-accent-color" value="${config.theme.accentColor}">
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Entity Gap</span>
            <span class="prefs-row-hint">Space between agents within a group</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-entity-gap" min="0" max="24" value="${config.theme.entityGap ?? 8}">
            <span class="prefs-range-value" id="pref-entity-gap-val">${config.theme.entityGap ?? 8}px</span>
          </div>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Group Gap</span>
            <span class="prefs-row-hint">Space between groups</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-group-gap" min="0" max="32" value="${config.theme.groupGap ?? 12}">
            <span class="prefs-range-value" id="pref-group-gap-val">${config.theme.groupGap ?? 12}px</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSoundPage(config: Config): string {
  return `
    <div class="prefs-page" data-page="sound">
      <div class="prefs-page-title">Sound</div>

      <div class="prefs-section">
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Sound Effects</span>
            <span class="prefs-row-hint">Play sounds on agent state changes</span>
          </div>
          ${toggleSwitch("pref-sound-enabled", config.sound.enabled)}
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Volume</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-sound-volume" min="0" max="100" value="${Math.round(config.sound.volume * 100)}">
            <span class="prefs-range-value" id="pref-sound-volume-val">${Math.round(config.sound.volume * 100)}%</span>
          </div>
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Sound Pack</span>
          </div>
          <select class="prefs-select" id="pref-sound-pack">
            <option value="default" ${config.sound.pack === "default" ? "selected" : ""}>Default</option>
            <option value="retro" ${config.sound.pack === "retro" ? "selected" : ""}>Retro</option>
            <option value="sci-fi" ${config.sound.pack === "sci-fi" ? "selected" : ""}>Sci-Fi Console</option>
            <option value="zen" ${config.sound.pack === "zen" ? "selected" : ""}>Zen</option>
            <option value="arcade" ${config.sound.pack === "arcade" ? "selected" : ""}>Arcade</option>
            <option value="typewriter" ${config.sound.pack === "typewriter" ? "selected" : ""}>Typewriter</option>
            <option value="bubble-pop" ${config.sound.pack === "bubble-pop" ? "selected" : ""}>Bubble Pop</option>
            <option value="glitch" ${config.sound.pack === "glitch" ? "selected" : ""}>Glitch</option>
            <option value="xylophone" ${config.sound.pack === "xylophone" ? "selected" : ""}>Xylophone</option>
            <option value="synth-pad" ${config.sound.pack === "synth-pad" ? "selected" : ""}>Synth Pad</option>
            <option value="ui-minimal" ${config.sound.pack === "ui-minimal" ? "selected" : ""}>UI Minimal</option>
            <option value="nature" ${config.sound.pack === "nature" ? "selected" : ""}>Nature</option>
          </select>
        </div>
      </div>

      <div class="prefs-section">
        <div class="prefs-section-title">Per-State Overrides</div>
        <div class="sound-slots" id="sound-slots"></div>
      </div>
    </div>
  `;
}

function renderBehaviorPage(config: Config): string {
  return `
    <div class="prefs-page" data-page="behavior">
      <div class="prefs-page-title">Behavior</div>

      <div class="prefs-section">
        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Always on Top</span>
            <span class="prefs-row-hint">Keep the monitor window above other windows</span>
          </div>
          ${toggleSwitch("pref-always-on-top", config.alwaysOnTop)}
        </div>

        <div class="prefs-row">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Edge Snapping</span>
            <span class="prefs-row-hint">Snap window to screen edges when dragged nearby</span>
          </div>
          ${toggleSwitch("pref-snap-enabled", config.snap.enabled)}
        </div>

        <div class="prefs-row" id="pref-snap-padding-row" style="display: ${config.snap.enabled ? "flex" : "none"}">
          <div class="prefs-row-info">
            <span class="prefs-row-label">Edge Padding</span>
            <span class="prefs-row-hint">Gap between window and screen edge</span>
          </div>
          <div class="prefs-range-wrap">
            <input type="range" class="prefs-range" id="pref-snap-padding" min="0" max="32" value="${config.snap.edgePadding}">
            <span class="prefs-range-value" id="pref-snap-padding-val">${config.snap.edgePadding}px</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAboutPage(version: string): string {
  return `
    <div class="prefs-page" data-page="about">
      <div class="prefs-page-title">About</div>
      <div class="prefs-section">
        <div class="about-info">
          <strong>Spacebar</strong><br>
          A desktop companion that visualizes your AI agent sessions.<br><br>
          Built with Tauri + TypeScript.<br>
          <span class="about-version">v${version}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Components ──────────────────────────────────────

function toggleSwitch(id: string, checked: boolean): string {
  return `
    <label class="toggle-switch">
      <input type="checkbox" id="${id}" ${checked ? "checked" : ""}>
      <span class="toggle-slider"></span>
    </label>
  `;
}

// ── Sound slots ─────────────────────────────────────

const SOUND_STATES: { key: string; label: string }[] = [
  { key: "entering", label: "Entering" },
  { key: "exiting", label: "Exiting" },
  { key: "thinking", label: "Thinking" },
  { key: "needs-input", label: "Input" },
  { key: "error", label: "Error" },
  { key: "compacting", label: "Compacting" },
  { key: "notification", label: "Notify" },
];

const SOUND_MAP: Record<string, string> = {
  entering: "enter.wav",
  exiting: "exit.wav",
  thinking: "tick.wav",
  "needs-input": "ping.wav",
  error: "buzz.wav",
  compacting: "squeeze.wav",
  notification: "bell.wav",
};

function resolveSoundUrl(state: string, pack: string, overrides: Record<string, string>): string {
  if (overrides[state]) return convertFileSrc(overrides[state]);
  return `/sounds/${pack}/${SOUND_MAP[state]}`;
}

function renderSoundSlots(config: Config, save: () => Promise<void>): void {
  if (!config.sound.muted) config.sound.muted = [];
  const container = document.getElementById("sound-slots")!;
  container.innerHTML = SOUND_STATES.map(({ key, label }) => {
    const isOverridden = !!config.sound.overrides[key];
    const isMuted = config.sound.muted.includes(key);
    const source = isOverridden
      ? config.sound.overrides[key].split("/").pop()
      : "Pack default";
    return `
      <div class="sound-slot${isMuted ? " sound-slot-muted" : ""}" data-state="${key}">
        <label class="sound-slot-mute-toggle">
          <input type="checkbox" data-action="mute" ${isMuted ? "" : "checked"}>
          <span class="sound-slot-mute-slider"></span>
        </label>
        <span class="sound-slot-label">${label}</span>
        <span class="sound-slot-source" title="${isOverridden ? config.sound.overrides[key] : ""}">${source}</span>
        <button class="sound-slot-btn" data-action="play" title="Preview"${isMuted ? " disabled" : ""}>&#9654;</button>
        <button class="sound-slot-btn" data-action="pick" title="Choose file"${isMuted ? " disabled" : ""}>&#128194;</button>
        ${isOverridden ? `<button class="sound-slot-btn sound-slot-reset" data-action="reset" title="Reset to pack"${isMuted ? " disabled" : ""}>&#10005;</button>` : ""}
      </div>`;
  }).join("");

  container.onclick = async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("[data-action]") as HTMLElement | null;
    if (!btn) return;
    const slot = btn.closest(".sound-slot") as HTMLElement;
    const state = slot.dataset.state!;
    const action = btn.dataset.action;

    if (action === "mute") {
      const idx = config.sound.muted.indexOf(state);
      if (idx >= 0) config.sound.muted.splice(idx, 1);
      else config.sound.muted.push(state);
      await save();
      renderSoundSlots(config, save);
    } else if (action === "play") {
      const url = resolveSoundUrl(state, config.sound.pack, config.sound.overrides);
      const audio = new Audio(url);
      audio.volume = config.sound.volume;
      audio.play().catch(() => {});
    } else if (action === "pick") {
      const path = await invoke<string | null>("pick_sound_file");
      if (path) {
        config.sound.overrides[state] = path;
        await save();
        renderSoundSlots(config, save);
      }
    } else if (action === "reset") {
      delete config.sound.overrides[state];
      await save();
      renderSoundSlots(config, save);
    }
  };
}

// Called once during init() — container listener is not cleaned up on re-render
function renderDisplayModes(config: Config, save: () => Promise<void>): void {
  if (!config.displayModes) config.displayModes = {};
  const container = document.getElementById("pref-display-modes");
  if (!container) return;

  const agentTypes = new Set<string>(["claude-code", ...Object.keys(config.displayModes)]);

  container.innerHTML = Array.from(agentTypes).map(agent => {
    const mode = config.displayModes[agent] ?? "mascot";
    const canUseIcon = hasIcon(agent);
    return `
      <div class="display-mode-row">
        <span class="display-mode-agent">${agent}</span>
        <select class="prefs-select" data-agent="${agent}" style="min-width:90px;">
          <option value="mascot" ${mode === "mascot" ? "selected" : ""}>Mascot</option>
          ${canUseIcon ? `<option value="icon" ${mode === "icon" ? "selected" : ""}>Icon</option>` : ""}
        </select>
      </div>`;
  }).join("");

  container.addEventListener("change", (e) => {
    const select = e.target as HTMLSelectElement;
    const agent = select.dataset.agent;
    if (!agent) return;
    const value = select.value;
    if (value === "mascot") {
      delete config.displayModes[agent];
    } else {
      config.displayModes[agent] = value;
    }
    const dotRow = document.getElementById("pref-dot-corner-row");
    if (dotRow) {
      const hasIcon = Object.values(config.displayModes).includes("icon");
      dotRow.style.display = hasIcon ? "flex" : "none";
    }
    save();
  });
}

// ── Bind helpers ────────────────────────────────────

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
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return;
  const valSpan = document.getElementById(el.id + "-val");
  el.addEventListener("input", (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    if (valSpan) valSpan.textContent = v + "%";
    cb(v);
  });
}

function bindRangePx(selector: string, cb: (v: number) => void): void {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return;
  const valSpan = document.getElementById(el.id + "-val");
  el.addEventListener("input", (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    if (valSpan) valSpan.textContent = v + "px";
    cb(v);
  });
}

init();
