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
  /** @type {Array<import('vitest').Mock>} */
  const originalAudio = globalThis.Audio;
  let createdAudios;

  beforeEach(() => {
    createdAudios = [];
    globalThis.Audio = class {
      constructor(url) {
        this.url = url;
        this.muted = false;
        this.volume = 1;
        this.loop = false;
        createdAudios.push(this);
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

  it('plays a registered key and applies mute/volume to the created Audio element', () => {
    const audio = new AudioManager({ settings: fakeSettings({ muted: true, volume: 0.4 }) });
    audio.register('theme', '/theme.mp3');
    audio.playMusic('theme');

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].url).toBe('/theme.mp3');
    expect(createdAudios[0].loop).toBe(true);
    expect(createdAudios[0].muted).toBe(true);
    expect(createdAudios[0].volume).toBe(0.4);
  });

  it('stops previous music before playing a new track', () => {
    const audio = new AudioManager();
    audio.register('a', '/a.mp3');
    audio.register('b', '/b.mp3');
    audio.playMusic('a');
    const first = createdAudios[0];
    const pauseSpy = vi.spyOn(first, 'pause');

    audio.playMusic('b');

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(createdAudios).toHaveLength(2);
    expect(createdAudios[1].url).toBe('/b.mp3');
  });
});
