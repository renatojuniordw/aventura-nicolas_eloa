import { AUDIO_SETTINGS_KEY } from './storage-keys.js';
import type { StorageAdapter } from './storage-adapter.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface AudioSettingsValue {
  muted: boolean;
  volume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
}

const DEFAULTS: AudioSettingsValue = Object.freeze({
  muted: false, volume: 0.8, musicVolume: 0.55, sfxVolume: 0.8, voiceVolume: 1,
});

interface AudioSettingsStoreOptions {
  adapter: StorageAdapter;
}

/**
 * Persists mute/volume as a device-level preference, separate from the
 * per-profile SaveStore document (which is versioned/migrated for a
 * different concern).
 */
export class AudioSettingsStore {
  private _adapter: StorageAdapter;

  constructor({ adapter }: AudioSettingsStoreOptions) {
    this._adapter = adapter;
  }

  read(): AudioSettingsValue {
    const raw = this._adapter.read(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    try {
      const value = JSON.parse(raw);
      return {
        muted: Boolean(value.muted),
        volume: clamp01(value.volume ?? DEFAULTS.volume),
        musicVolume: clamp01(value.musicVolume ?? DEFAULTS.musicVolume),
        sfxVolume: clamp01(value.sfxVolume ?? value.volume ?? DEFAULTS.sfxVolume),
        voiceVolume: clamp01(value.voiceVolume ?? DEFAULTS.voiceVolume),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  write(settings: AudioSettingsValue): void {
    this._adapter.write(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  }
}
