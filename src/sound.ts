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
    sound?: { enabled?: boolean; volume?: number; pack?: string; overrides?: Record<string, string>; muted?: string[] };
  }>("get_config");
  enabled = config.sound?.enabled ?? true;
  volume = config.sound?.volume ?? 0.5;
  activePack = config.sound?.pack ?? "default";
  overrides = config.sound?.overrides ?? {};
  muted = config.sound?.muted ?? [];
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
