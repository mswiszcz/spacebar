import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, currentMonitor, PhysicalPosition } from "@tauri-apps/api/window";
import { Session, Group, sessionState } from "./state";
import { initMascotGrid, triggerExit, markSilentUpdate, updateDisplayConfig } from "./mascot-grid";
import { initSound, updateSoundSettings } from "./sound";
import { initTooltip } from "./tooltip";
import { initPreferences } from "./preferences";

interface Config {
  orientation: string;
  alwaysOnTop: boolean;
  mascotSize: string;
  showLabels: boolean;
  showTooltips: boolean;
  position: { x: number; y: number };
  soundEnabled: boolean;
  soundVolume: number;
  soundPack: string;
  states: Record<string, { color?: string; soundOverride?: string; muted?: boolean }>;
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

const SNAP_THRESHOLD = 50;

function computeSnapPosition(
  windowX: number,
  windowY: number,
  windowWidth: number,
  windowHeight: number,
  monitorX: number,
  monitorY: number,
  monitorWidth: number,
  monitorHeight: number,
  edgePadding: number,
): { edge: string; x: number; y: number } | null {
  const distTop = windowY - monitorY;
  const distBottom = (monitorY + monitorHeight) - (windowY + windowHeight);
  const distLeft = windowX - monitorX;
  const distRight = (monitorX + monitorWidth) - (windowX + windowWidth);

  const edges: { edge: string; dist: number }[] = [];
  if (distTop < SNAP_THRESHOLD) edges.push({ edge: "top", dist: Math.abs(distTop) });
  if (distBottom < SNAP_THRESHOLD) edges.push({ edge: "bottom", dist: Math.abs(distBottom) });
  if (distLeft < SNAP_THRESHOLD) edges.push({ edge: "left", dist: Math.abs(distLeft) });
  if (distRight < SNAP_THRESHOLD) edges.push({ edge: "right", dist: Math.abs(distRight) });

  if (edges.length === 0) return null;

  edges.sort((a, b) => a.dist - b.dist);
  const closest = edges[0];

  let x: number;
  let y: number;

  switch (closest.edge) {
    case "top":
      x = monitorX + Math.round((monitorWidth - windowWidth) / 2);
      y = monitorY + edgePadding;
      break;
    case "bottom":
      x = monitorX + Math.round((monitorWidth - windowWidth) / 2);
      y = monitorY + monitorHeight - windowHeight - edgePadding;
      break;
    case "left":
      x = monitorX + edgePadding;
      y = monitorY + Math.round((monitorHeight - windowHeight) / 2);
      break;
    case "right":
      x = monitorX + monitorWidth - windowWidth - edgePadding;
      y = monitorY + Math.round((monitorHeight - windowHeight) / 2);
      break;
    default:
      return null;
  }

  return { edge: closest.edge, x, y };
}

function applyConfig(config: Config): void {
  const app = document.getElementById("app")!;
  const grid = app.querySelector(".mascot-grid") as HTMLElement;

  // Apply orientation
  if (grid) {
    grid.classList.toggle("vertical", config.orientation === "vertical");
  }

  // Apply theme as CSS custom properties
  const root = document.documentElement;
  root.style.setProperty("--bg-color", config.theme.backgroundColor);
  root.style.setProperty("--bg-opacity", String(config.theme.backgroundOpacity));
  root.style.setProperty("--accent-color", config.theme.accentColor);
  root.style.setProperty("--entity-gap", (config.theme.entityGap ?? 8) + "px");
  root.style.setProperty("--group-gap", (config.theme.groupGap ?? 12) + "px");

  // Apply size class (preserve other classes like split-view)
  app.classList.remove("size-small", "size-medium", "size-large");
  app.classList.add(`size-${config.mascotSize}`);

  // Apply label visibility
  app.classList.toggle("hide-labels", !config.showLabels);

  // Re-apply native blur radius
  invoke("set_blur_radius", {
    radius: config.theme.blurRadius,
  }).catch(() => {});

  // Apply display mode config
  updateDisplayConfig(
    config.displayModes ?? {},
    config.statusDotCorner ?? "top-left",
    config.states ?? {},
    config.theme.accentColor,
  );

  // Resize window to fit new layout (orientation, size, labels may change dimensions)
  resizeWindow();

  // Build overrides and muted list from states for sound module
  const soundOverrides: Record<string, string> = {};
  const soundMuted: string[] = [];
  for (const [state, cfg] of Object.entries(config.states ?? {})) {
    if (cfg.soundOverride) soundOverrides[state] = cfg.soundOverride;
    if (cfg.muted) soundMuted.push(state);
  }
  updateSoundSettings(config.soundEnabled, config.soundVolume, config.soundPack, soundOverrides, soundMuted);
}

let _snapConfig: { enabled: boolean; edgePadding: number; snappedEdge: string | null } | null = null;
let _isSnapping = false;

async function resizeWindow(): Promise<void> {
  const grid = document.querySelector(".mascot-grid") as HTMLElement;
  if (!grid) return;

  const appWindow = getCurrentWindow();
  requestAnimationFrame(async () => {
    // In split view, macOS controls the window size — don't resize it ourselves.
    // But do handle shrink overflow mode if configured.
    if (document.getElementById("app")?.classList.contains("split-view")) {
      const cfg = await invoke<Config>("get_config");
      if (cfg.splitView?.overflowBehavior === "shrink") {
        const sizes = ["large", "medium", "small"] as const;
        const appEl = document.getElementById("app")!;
        const containerHeight = window.innerHeight;

        grid.classList.remove("overflow-scroll");
        for (const size of sizes) {
          appEl.classList.remove("size-small", "size-medium", "size-large");
          appEl.classList.add(`size-${size}`);
          await new Promise(r => requestAnimationFrame(r));
          if (grid.scrollHeight <= containerHeight) break;
        }

        // If still overflowing at small, fall back to scroll
        if (grid.scrollHeight > containerHeight) {
          grid.classList.add("overflow-scroll");
        }
      }
      return;
    }

    const width = grid.scrollWidth;
    const height = grid.scrollHeight;
    await appWindow.setSize(
      new LogicalSize(Math.max(width, 64), Math.max(height, 64))
    );

    // Re-center on snapped edge after resize
    if (_snapConfig?.snappedEdge) {
      const monitor = await currentMonitor();
      if (!monitor) return;
      const size = await appWindow.outerSize();
      let x: number, y: number;
      const edge = _snapConfig.snappedEdge;
      const padding = _snapConfig.edgePadding * monitor.scaleFactor;
      switch (edge) {
        case "top":
          x = monitor.position.x + Math.round((monitor.size.width - size.width) / 2);
          y = monitor.position.y + padding;
          break;
        case "bottom":
          x = monitor.position.x + Math.round((monitor.size.width - size.width) / 2);
          y = monitor.position.y + monitor.size.height - size.height - padding;
          break;
        case "left":
          x = monitor.position.x + padding;
          y = monitor.position.y + Math.round((monitor.size.height - size.height) / 2);
          break;
        case "right":
          x = monitor.position.x + monitor.size.width - size.width - padding;
          y = monitor.position.y + Math.round((monitor.size.height - size.height) / 2);
          break;
        default:
          return;
      }
      _isSnapping = true;
      await appWindow.setPosition(new PhysicalPosition(x, y));
      _isSnapping = false;
      await invoke("save_position", { x, y });
    }
  });
}

async function init(): Promise<void> {
  const app = document.getElementById("app")!;
  await initSound();
  await initTooltip();
  initPreferences(applyConfig);
  initMascotGrid(app);

  // Create empty state (shown in split view when no agents)
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.innerHTML = `<img src="/icons/128x128.png" class="empty-state-icon" alt="Spacebar" />`;
  app.appendChild(emptyState);

  // Create split-view green button
  const splitBtn = document.createElement("button");
  splitBtn.className = "split-view-btn";
  splitBtn.title = "Enter Split View";
  splitBtn.addEventListener("click", async (e) => {
    e.stopPropagation(); // Prevent window drag
    await invoke("toggle_split_view");
  });
  app.appendChild(splitBtn);

  // Split View state
  let _isSplitView = false;
  let _preSplitOrientation: string | null = null;

  // Snap orientation override state
  let _preSnapOrientation: string | null = null;

  // Load and apply initial config
  let config = await invoke<Config>("get_config");
  _snapConfig = config.snap;

  // If already in fullscreen/split view at launch, force vertical
  _isSplitView = await invoke<boolean>("is_split_view");
  if (_isSplitView) {
    _preSplitOrientation = config.orientation;
    app.classList.add("split-view");
    config.orientation = "vertical";
  }

  applyConfig(config);

  await listen<Config>("config-changed", (event) => {
    const userOrientation = event.payload.orientation;
    config = event.payload;
    _snapConfig = event.payload.snap;

    // Keep pre-snap/pre-split backups in sync with user preference
    if (_preSnapOrientation !== null) {
      _preSnapOrientation = userOrientation;
    }
    if (_preSplitOrientation !== null) {
      _preSplitOrientation = userOrientation;
    }

    // Reapply transient orientation overrides
    if (_isSplitView) {
      config.orientation = "vertical";
    } else if (_preSnapOrientation !== null && _snapConfig?.snappedEdge) {
      const edge = _snapConfig.snappedEdge;
      config.orientation = (edge === "left" || edge === "right") ? "vertical" : "horizontal";
    }

    applyConfig(config);
  });

  // Load existing groups and sessions (in case frontend reloads)
  const existingGroups = await invoke<Group[]>("get_groups");
  existingGroups.forEach((g) => sessionState.addGroup(g));

  const existing = await invoke<Session[]>("get_sessions");
  existing.forEach((s) => sessionState.add(s));

  // Resize on session or group changes
  sessionState.subscribe(() => resizeWindow());
  sessionState.subscribeGroups(() => resizeWindow());

  if (existing.length > 0) {
    resizeWindow();
  }

  // Listen for backend events
  await listen<Session>("session-added", (event) => {
    emptyState.classList.remove("visible");
    sessionState.add(event.payload);
  });

  await listen("sessions-empty", () => {
    emptyState.classList.add("visible");
  });

  await listen<Session & { noSound?: boolean }>("session-updated", (event) => {
    if (event.payload.noSound) {
      markSilentUpdate(event.payload.sessionId);
    }
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

  await listen<Group>("group-added", (event) => {
    sessionState.addGroup(event.payload);
  });

  await listen<Group>("group-updated", (event) => {
    sessionState.updateGroup(event.payload);
  });

  await listen<{ groupId: string }>("group-removed", (event) => {
    sessionState.removeGroup(event.payload.groupId);
  });

  // Auto-show/hide the green split-view button on mouse movement
  let splitBtnTimeout: number | null = null;
  document.addEventListener("mousemove", () => {
    if (_isSplitView) return; // Hide in Split View (exit via macOS gestures)
    splitBtn.classList.add("split-view-btn-visible");
    if (splitBtnTimeout !== null) clearTimeout(splitBtnTimeout);
    splitBtnTimeout = window.setTimeout(() => {
      splitBtn.classList.remove("split-view-btn-visible");
    }, 1500);
  });

  // Disable hover effects when window loses focus
  window.addEventListener("blur", () => document.body.classList.add("window-blurred"));
  window.addEventListener("focus", () => document.body.classList.remove("window-blurred"));

  // Enable dragging from anywhere on the window
  // Alt/Option + click on mascots also drags
  document.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    const isMascot = target.closest(".mascot-item");

    if (isMascot && !e.altKey) {
      return;
    }
    if (
      !isMascot &&
      (target.closest("input") ||
        target.closest("select") ||
        target.closest("button"))
    ) {
      return;
    }
    if (e.button === 0) {
      getCurrentWindow().startDragging();
    }
  });

  // Save window position on move, with snap detection and fullscreen space detection
  let snapDebounce: number | null = null;
  await listen("tauri://move", async () => {
    if (_isSnapping) return;

    const appWindow = getCurrentWindow();
    const pos = await appWindow.outerPosition();
    await invoke("save_position", { x: pos.x, y: pos.y });

    if (snapDebounce !== null) clearTimeout(snapDebounce);
    snapDebounce = window.setTimeout(async () => {
      snapDebounce = null;

      // Auto-enter Split View when dragged to a fullscreen space
      if (!_isSplitView) {
        const onFullscreenSpace = await invoke<boolean>("is_on_fullscreen_space");
        if (onFullscreenSpace) {
          await invoke("toggle_split_view");
          return;
        }
      }

      if (!config.snap.enabled) return;

      const monitor = await currentMonitor();
      if (!monitor) return;

      const size = await appWindow.outerSize();
      const currentPos = await appWindow.outerPosition();

      const snap = computeSnapPosition(
        currentPos.x, currentPos.y,
        size.width, size.height,
        monitor.position.x, monitor.position.y,
        monitor.size.width, monitor.size.height,
        config.snap.edgePadding * monitor.scaleFactor,
      );

      if (snap) {
        _isSnapping = true;
        await appWindow.setPosition(new PhysicalPosition(snap.x, snap.y));
        _isSnapping = false;
        config.snap.snappedEdge = snap.edge;
        const newOrientation = (snap.edge === "left" || snap.edge === "right") ? "vertical" : "horizontal";
        if (config.orientation !== newOrientation) {
          if (_preSnapOrientation === null) {
            _preSnapOrientation = config.orientation;
          }
          config.orientation = newOrientation;
          applyConfig(config);
        }
      } else {
        config.snap.snappedEdge = null;
        if (_preSnapOrientation !== null) {
          config.orientation = _preSnapOrientation;
          _preSnapOrientation = null;
          applyConfig(config);
        }
      }

      // Save config with user's preferred orientation, not the transient snap override
      const configToSave = _preSnapOrientation !== null
        ? { ...config, orientation: _preSnapOrientation }
        : config;
      await invoke("save_config", { config: configToSave });
    }, 150);
  });

  // Detect Split View (fullscreen) state changes via resize events (debounced)
  let splitViewDebounce: number | null = null;
  await listen("tauri://resize", () => {
    if (splitViewDebounce !== null) clearTimeout(splitViewDebounce);
    splitViewDebounce = window.setTimeout(async () => {
      splitViewDebounce = null;
      const inSplitView = await invoke<boolean>("is_split_view");
      if (inSplitView === _isSplitView) return;
      _isSplitView = inSplitView;

      if (inSplitView) {
        // Entering Split View
        _preSplitOrientation = config.orientation;
        app.classList.add("split-view");
        config.orientation = "vertical";

        // Apply overflow mode
        const grid = document.querySelector(".mascot-grid") as HTMLElement;
        if (grid) {
          const overflow = config.splitView?.overflowBehavior ?? "scroll";
          grid.classList.toggle("overflow-scroll", overflow === "scroll");
        }

        splitBtn.title = "Exit Split View";
        splitBtn.classList.remove("split-view-btn-visible");
        applyConfig(config);
      } else {
        // Exiting Split View — restore window state after animation completes
        await invoke("restore_after_split_view");
        app.classList.remove("split-view");

        const grid = document.querySelector(".mascot-grid") as HTMLElement;
        if (grid) {
          grid.classList.remove("overflow-scroll");
        }

        if (_preSplitOrientation) {
          config.orientation = _preSplitOrientation;
          _preSplitOrientation = null;
        }

        splitBtn.title = "Enter Split View";
        applyConfig(config);
        resizeWindow();
      }
    }, 100);
  });
}

// Export for preferences to use
export { applyConfig, resizeWindow };
export type { Config };

init();
