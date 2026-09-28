import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioManager } from './audio-manager.js';
import { SFX_CATALOG, Sfx, registerSfxCatalog } from './sfx-catalog.js';

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
  let playImpl;

  beforeEach(() => {
    createdAudios = [];
    playImpl = () => Promise.resolve();
    globalThis.Audio = class {
      constructor(url) {
        this.url = url;
        this.muted = false;
        this.volume = 1;
        this.loop = false;
        createdAudios.push(this);
      }
      play() {
        return playImpl(this);
      }
      pause() {
        this.paused = true;
      }
      addEventListener(type, handler) {
        (this.listeners ??= {})[type] = handler;
      }
      emit(type) {
        this.listeners?.[type]?.();
      }
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
    expect(settings.write).toHaveBeenCalledWith({ muted: true, volume: 0.8, musicVolume: 0.55, sfxVolume: 0.8, voiceVolume: 1 });
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
    expect(createdAudios[0].volume).toBeCloseTo(0.22);
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

  it('unlock() plays a muted probe element and flips isUnlocked', () => {
    const audio = new AudioManager();
    expect(audio.isUnlocked).toBe(false);

    audio.unlock();

    expect(audio.isUnlocked).toBe(true);
    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].muted).toBe(true);
  });

  it('unlock() is a no-op after the first call', () => {
    const audio = new AudioManager();
    audio.unlock();
    audio.unlock();
    expect(createdAudios).toHaveLength(1);
  });

  describe('effects', () => {
    it('applies master × effects × per-sound gain to the element', () => {
      const audio = new AudioManager({ settings: fakeSettings({ muted: false, volume: 0.5, sfxVolume: 0.8 }) });
      audio.register('ding', '/ding.wav', { gain: 0.5 });
      expect(audio.playSfx('ding')).toBe(true);
      expect(createdAudios[0].url).toBe('/ding.wav');
      expect(createdAudios[0].volume).toBeCloseTo(0.2);
    });

    it('stays silent (creates nothing) when muted or when the effects volume is zero', () => {
      const muted = new AudioManager({ settings: fakeSettings({ muted: true, volume: 0.8 }) });
      muted.register('ding', '/ding.wav');
      expect(muted.playSfx('ding')).toBe(false);

      const zero = new AudioManager();
      zero.register('ding', '/ding.wav');
      zero.setCategoryVolume('sfx', 0);
      expect(zero.playSfx('ding')).toBe(false);
      expect(createdAudios).toHaveLength(0);
    });

    it('propagates mute and volume changes to effects already playing', () => {
      const audio = new AudioManager();
      audio.register('ding', '/ding.wav');
      audio.playSfx('ding');
      const playing = createdAudios[0];

      audio.setCategoryVolume('sfx', 0.5);
      expect(playing.volume).toBeCloseTo(0.4);
      audio.setMuted(true);
      expect(playing.muted).toBe(true);
    });

    it('forgets an effect when it ends or fails to load', () => {
      const audio = new AudioManager();
      audio.register('a', '/a.wav');
      audio.register('b', '/b.wav');
      audio.playSfx('a');
      audio.playSfx('b');
      expect(audio.activeSfxCount).toBe(2);
      createdAudios[0].emit('ended');
      createdAudios[1].emit('error');
      expect(audio.activeSfxCount).toBe(0);
    });

    it('replaying a key cuts its previous instance instead of stacking it', () => {
      const audio = new AudioManager();
      audio.register('ding', '/ding.wav');
      audio.playSfx('ding');
      audio.playSfx('ding');
      expect(createdAudios[0].paused).toBe(true);
      expect(audio.activeSfxCount).toBe(1);
    });

    it('caps overlapping effects, cutting the oldest first', () => {
      const audio = new AudioManager({ maxActiveSfx: 2 });
      for (const key of ['a', 'b', 'c']) audio.register(key, `/${key}.wav`);
      audio.playSfx('a');
      audio.playSfx('b');
      audio.playSfx('c');
      expect(createdAudios[0].paused).toBe(true);
      expect(createdAudios[1].paused).toBeUndefined();
      expect(audio.activeSfxCount).toBe(2);
    });

    it('stopSfx() pauses and forgets every effect in flight', () => {
      const audio = new AudioManager();
      audio.register('a', '/a.wav');
      audio.register('b', '/b.wav');
      audio.playSfx('a');
      audio.playSfx('b');
      audio.stopSfx();
      expect(createdAudios.every((element) => element.paused)).toBe(true);
      expect(audio.activeSfxCount).toBe(0);
    });

    it('never throws when playback is rejected or the element cannot be built', async () => {
      const audio = new AudioManager();
      audio.register('ding', '/ding.wav');
      playImpl = () => Promise.reject(new Error('NotAllowedError'));
      expect(() => audio.playSfx('ding')).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
      expect(audio.activeSfxCount).toBe(0);

      playImpl = () => { throw new Error('boom'); };
      expect(audio.playSfx('ding')).toBe(false);

      globalThis.Audio = class { constructor() { throw new Error('no audio'); } };
      expect(audio.playSfx('ding')).toBe(false);
    });

    it('registers the answer effects from the catalog under /assets/audio/sfx/', () => {
      const audio = new AudioManager();
      registerSfxCatalog(audio);
      audio.playSfx(Sfx.ANSWER_SUCCESS);
      audio.playSfx(Sfx.ANSWER_ERROR);
      expect(createdAudios.map((element) => element.url)).toEqual([
        '/assets/audio/sfx/answer_success.wav',
        '/assets/audio/sfx/answer_error.wav',
      ]);
      for (const { url } of SFX_CATALOG) expect(url.startsWith('/assets/audio/sfx/')).toBe(true);
    });
  });
});
