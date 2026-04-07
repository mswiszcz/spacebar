import { invoke, convertFileSrc } from "@tauri-apps/api/core";

const SOUND_MAP: Record<string, string> = {
  entering: "enter.wav",
  exiting: "exit.wav",
  thinking: "tick.wav",
  "needs-input": "ping.wav",
  error: "buzz.wav",
  compacting: "squeeze.wav",
  notification: "bell.wav",
};

const audioCache: Map<string, HTMLAudioElement> = new Map();
let enabled = true;
let volume = 0.5;
let activePack = "default";
let overrides: Record<string, string> = {};
let muted: string[] = [];

export async function initSound(): Promise<void> {
  const config = await invoke<{
    soundEnabled?: boolean;
    soundVolume?: number;
    soundPack?: string;
    states?: Record<string, { soundOverride?: string; muted?: boolean }>;
  }>("get_config");
  enabled = config.soundEnabled ?? true;
  volume = config.soundVolume ?? 0.5;
  activePack = config.soundPack ?? "default";
  overrides = {};
  muted = [];
  for (const [state, cfg] of Object.entries(config.states ?? {})) {
    if (cfg.soundOverride) overrides[state] = cfg.soundOverride;
    if (cfg.muted) muted.push(state);
  }
}

export function updateSoundSettings(
  soundEnabled: boolean,
  soundVolume: number,
  pack: string,
  soundOverrides: Record<string, string>,
  soundMuted: string[],
): void {
  const packChanged = pack !== activePack;
  const overridesChanged = JSON.stringify(soundOverrides) !== JSON.stringify(overrides);

  enabled = soundEnabled;
  volume = soundVolume;
  activePack = pack;
  overrides = soundOverrides;
  muted = soundMuted;

  if (packChanged || overridesChanged) {
    audioCache.clear();
  }
}

export function resolveSoundUrl(state: string): string | null {
  if (overrides[state]) {
    return convertFileSrc(overrides[state]);
  }
  const file = SOUND_MAP[state];
  if (!file) return null;
  return `/sounds/${activePack}/${file}`;
}

export function playStateSound(state: string, noSound?: boolean): void {
  if (!enabled || noSound || muted.includes(state)) return;

  const url = resolveSoundUrl(state);
  if (!url) return;

  let audio = audioCache.get(url);
  if (!audio) {
    audio = new Audio(url);
    audioCache.set(url, audio);
  }

  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
