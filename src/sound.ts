import { invoke } from "@tauri-apps/api/core";

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

export async function initSound(): Promise<void> {
  const config = await invoke<{ sound?: { enabled?: boolean; volume?: number } }>("get_config");
  enabled = config.sound?.enabled ?? true;
  volume = config.sound?.volume ?? 0.5;
}

export function updateSoundSettings(soundEnabled: boolean, soundVolume: number): void {
  enabled = soundEnabled;
  volume = soundVolume;
}

export function playStateSound(state: string): void {
  if (!enabled) return;

  const file = SOUND_MAP[state];
  if (!file) return;

  let audio = audioCache.get(file);
  if (!audio) {
    audio = new Audio(`/sounds/${file}`);
    audioCache.set(file, audio);
  }

  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Audio play can fail if no user interaction yet; ignore
  });
}
