import { AUDIO_SETTINGS_KEY } from './storage-keys.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

const DEFAULTS = Object.freeze({ muted: false, volume: 0.8 });

/**
 * Persists mute/volume as a device-level preference, separate from the
 * per-profile SaveStore document (which is versioned/migrated for a
 * different concern).
 */
export class AudioSettingsStore {
  /** @param {{ adapter: import('./storage-adapter.js').StorageAdapter }} options */
  constructor({ adapter }) {
    this._adapter = adapter;
  }

  read() {
    const raw = this._adapter.read(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    try {
      const value = JSON.parse(raw);
      return {
        muted: Boolean(value.muted),
        volume: clamp01(value.volume ?? DEFAULTS.volume),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  write(settings) {
    this._adapter.write(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  }
}
