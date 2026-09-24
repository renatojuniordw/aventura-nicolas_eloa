function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface AudioSettings {
  read(): { muted: boolean; volume: number; musicVolume?: number; sfxVolume?: number; voiceVolume?: number };
  write(value: { muted: boolean; volume: number; musicVolume: number; sfxVolume: number; voiceVolume: number }): void;
}

interface AudioManagerOptions {
  settings?: AudioSettings | null;
}

/**
 * Mute/volume state plus a play API that is safe to call before any real
 * audio asset exists: playMusic/playSfx are no-ops for unregistered keys, so
 * the rest of the game can wire itself to this manager today and start
 * hearing sound the moment assets are registered later.
 */
export class AudioManager {
  private _settings: AudioSettings | null;
  private _registry = new Map<string, string>();
  private _currentMusic: HTMLAudioElement | null = null;
  private _unlocked = false;
  private _muted: boolean;
  private _volume: number;
  private _musicVolume: number;
  private _sfxVolume: number;
  private _voiceVolume: number;
  private _voiceActive = false;

  constructor({ settings = null }: AudioManagerOptions = {}) {
    this._settings = settings;

    const stored = settings?.read() ?? { muted: false, volume: 0.8 };
    this._muted = Boolean(stored.muted);
    this._volume = clamp01(stored.volume ?? 0.8);
    this._musicVolume = clamp01(stored.musicVolume ?? 0.55);
    this._sfxVolume = clamp01(stored.sfxVolume ?? this._volume);
    this._voiceVolume = clamp01(stored.voiceVolume ?? 1);
  }

  get isUnlocked(): boolean {
    return this._unlocked;
  }

  /**
   * Mobile browsers block `Audio.play()` outside a real user gesture. Call
   * this once, synchronously, from the first pointerdown/click handler of
   * the session (see main.js) — playing a muted element inside that gesture
   * is what tells the browser this origin is allowed to play audio, so every
   * `playMusic`/`playSfx` call afterwards works instead of silently failing.
   */
  unlock(): void {
    if (this._unlocked || typeof Audio === 'undefined') return;
    this._unlocked = true;
    const probe = new Audio();
    probe.muted = true;
    probe.play?.().catch(() => {});
  }

  get isMuted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  get musicVolume(): number { return this._musicVolume; }
  get sfxVolume(): number { return this._sfxVolume; }
  get voiceVolume(): number { return this._voiceVolume; }
  get isVoiceMuted(): boolean { return this._muted || this._voiceVolume === 0; }

  setMuted(muted: boolean): void {
    this._muted = Boolean(muted);
    this._applyToCurrent();
    this._persist();
  }

  toggleMuted(): void {
    this.setMuted(!this._muted);
  }

  setVolume(value: number): void {
    this._volume = clamp01(value);
    this._applyToCurrent();
    this._persist();
  }

  setCategoryVolume(category: 'music' | 'sfx' | 'voice', value: number): void {
    const next = clamp01(value);
    if (category === 'music') this._musicVolume = next;
    if (category === 'sfx') this._sfxVolume = next;
    if (category === 'voice') this._voiceVolume = next;
    this._applyToCurrent();
    this._persist();
  }

  setVoiceActive(active: boolean): void {
    this._voiceActive = active;
    this._applyToCurrent();
  }

  /** Associate a key (e.g. "music-menu") with a playable URL, for later use. */
  register(key: string, url: string): void {
    this._registry.set(key, url);
  }

  playMusic(key: string): void {
    const url = this._registry.get(key);
    if (!url) return;
    this.stopMusic();
    const audio = new Audio(url);
    audio.loop = true;
    audio.muted = this._muted;
    audio.volume = this._effectiveMusicVolume();
    audio.play?.().catch(() => {});
    this._currentMusic = audio;
  }

  stopMusic(): void {
    if (!this._currentMusic) return;
    this._currentMusic.pause();
    this._currentMusic = null;
  }

  playSfx(key: string): void {
    const url = this._registry.get(key);
    if (!url) return;
    const audio = new Audio(url);
    audio.muted = this._muted;
    audio.volume = this._volume * this._sfxVolume;
    audio.play?.().catch(() => {});
  }

  private _applyToCurrent(): void {
    if (!this._currentMusic) return;
    this._currentMusic.muted = this._muted;
    this._currentMusic.volume = this._effectiveMusicVolume();
  }

  private _effectiveMusicVolume(): number {
    return this._volume * this._musicVolume * (this._voiceActive ? 0.4 : 1);
  }

  private _persist(): void {
    this._settings?.write({
      muted: this._muted, volume: this._volume, musicVolume: this._musicVolume,
      sfxVolume: this._sfxVolume, voiceVolume: this._voiceVolume,
    });
  }
}
