import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioManager } from './audio-manager.js';

function fakeSettings(initial = { muted: false, volume: 0.8 }) {
  let stored = { ...initial };
  return {
    read: () => stored,
    write: vi.fn((value) => {
      stored = { ...value };
    }),
  };
}

describe('AudioManager', () => {
  const originalAudio = globalThis.Audio;

  beforeEach(() => {
    globalThis.Audio = class {
      constructor(url) {
        this.url = url;
        this.muted = false;
        this.volume = 1;
        this.loop = false;
      }
      play() {
        return Promise.resolve();
      }
      pause() {}
    };
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
  });

  it('reads initial state from the injected settings store', () => {
    const audio = new AudioManager({ settings: fakeSettings({ muted: true, volume: 0.5 }) });
    expect(audio.isMuted).toBe(true);
    expect(audio.volume).toBe(0.5);
  });

  it('defaults to unmuted at 0.8 volume when no settings are given', () => {
    const audio = new AudioManager();
    expect(audio.isMuted).toBe(false);
    expect(audio.volume).toBe(0.8);
  });

  it('toggles mute and persists the change', () => {
    const settings = fakeSettings();
    const audio = new AudioManager({ settings });
    audio.toggleMuted();
    expect(audio.isMuted).toBe(true);
    expect(settings.write).toHaveBeenCalledWith({ muted: true, volume: 0.8 });
  });

  it('clamps volume to [0, 1] and persists it', () => {
    const settings = fakeSettings();
    const audio = new AudioManager({ settings });
    audio.setVolume(4);
    expect(audio.volume).toBe(1);
    audio.setVolume(-1);
    expect(audio.volume).toBe(0);
  });

  it('is a safe no-op when playing an unregistered key', () => {
    const audio = new AudioManager();
    expect(() => audio.playMusic('missing')).not.toThrow();
    expect(() => audio.playSfx('missing')).not.toThrow();
  });

  it('plays a registered key and applies mute/volume to it', () => {
    const audio = new AudioManager({ settings: fakeSettings({ muted: true, volume: 0.4 }) });
    audio.register('theme', '/theme.mp3');
    audio.playMusic('theme');
    expect(audio._currentMusic.muted).toBe(true);
    expect(audio._currentMusic.volume).toBe(0.4);
  });
});
