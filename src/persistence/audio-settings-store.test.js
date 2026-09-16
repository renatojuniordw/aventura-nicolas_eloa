import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from './storage-adapter.js';
import { AudioSettingsStore } from './audio-settings-store.js';
import { AUDIO_SETTINGS_KEY } from './storage-keys.js';

describe('AudioSettingsStore', () => {
  it('returns defaults when nothing is stored', () => {
    const store = new AudioSettingsStore({ adapter: new MemoryStorageAdapter() });
    expect(store.read()).toEqual({ muted: false, volume: 0.8 });
  });

  it('round-trips a written value', () => {
    const store = new AudioSettingsStore({ adapter: new MemoryStorageAdapter() });
    store.write({ muted: true, volume: 0.3 });
    expect(store.read()).toEqual({ muted: true, volume: 0.3 });
  });

  it('recovers to defaults from corrupted JSON', () => {
    const adapter = new MemoryStorageAdapter({ [AUDIO_SETTINGS_KEY]: '{{{ broken' });
    const store = new AudioSettingsStore({ adapter });
    expect(store.read()).toEqual({ muted: false, volume: 0.8 });
  });

  it('clamps volume to [0, 1]', () => {
    const adapter = new MemoryStorageAdapter({
      [AUDIO_SETTINGS_KEY]: JSON.stringify({ muted: false, volume: 4 }),
    });
    const store = new AudioSettingsStore({ adapter });
    expect(store.read().volume).toBe(1);
  });
});
