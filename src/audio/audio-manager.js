function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Mute/volume state plus a play API that is safe to call before any real
 * audio asset exists: playMusic/playSfx are no-ops for unregistered keys, so
 * the rest of the game can wire itself to this manager today and start
 * hearing sound the moment assets are registered later.
 */
export class AudioManager {
  /** @param {{ settings?: { read(): {muted: boolean, volume: number}, write(value: object): void } }} options */
  constructor({ settings = null } = {}) {
    this._settings = settings;
    this._registry = new Map();
    this._currentMusic = null;
    this._unlocked = false;

    const stored = settings?.read() ?? { muted: false, volume: 0.8 };
    this._muted = Boolean(stored.muted);
    this._volume = clamp01(stored.volume ?? 0.8);
  }

  get isUnlocked() {
    return this._unlocked;
  }

  /**
   * Mobile browsers block `Audio.play()` outside a real user gesture. Call
   * this once, synchronously, from the first pointerdown/click handler of
   * the session (see main.js) — playing a muted element inside that gesture
   * is what tells the browser this origin is allowed to play audio, so every
   * `playMusic`/`playSfx` call afterwards works instead of silently failing.
   */
  unlock() {
    if (this._unlocked || typeof Audio === 'undefined') return;
    this._unlocked = true;
    const probe = new Audio();
    probe.muted = true;
    probe.play?.().catch(() => {});
  }

  get isMuted() {
    return this._muted;
  }

  get volume() {
    return this._volume;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    this._applyToCurrent();
    this._persist();
  }

  toggleMuted() {
    this.setMuted(!this._muted);
  }

  setVolume(value) {
    this._volume = clamp01(value);
    this._applyToCurrent();
    this._persist();
  }

  /** Associate a key (e.g. "music-menu") with a playable URL, for later use. */
  register(key, url) {
    this._registry.set(key, url);
  }

  playMusic(key) {
    const url = this._registry.get(key);
    if (!url) return;
    this.stopMusic();
    const audio = new Audio(url);
    audio.loop = true;
    audio.muted = this._muted;
    audio.volume = this._volume;
    audio.play?.().catch(() => {});
    this._currentMusic = audio;
  }

  stopMusic() {
    if (!this._currentMusic) return;
    this._currentMusic.pause();
    this._currentMusic = null;
  }

  playSfx(key) {
    const url = this._registry.get(key);
    if (!url) return;
    const audio = new Audio(url);
    audio.muted = this._muted;
    audio.volume = this._volume;
    audio.play?.().catch(() => {});
  }

  _applyToCurrent() {
    if (!this._currentMusic) return;
    this._currentMusic.muted = this._muted;
    this._currentMusic.volume = this._volume;
  }

  _persist() {
    this._settings?.write({ muted: this._muted, volume: this._volume });
  }
}
