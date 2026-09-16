import { Events, type EventBus } from '../core/event-bus.js';

interface LivesManagerOptions {
  lives?: number;
  maxLives?: number;
  bus?: EventBus | null;
}

/**
 * Owns the heart count. It is the single authority on losing lives, so a future
 * rule (extra life, shield) has one place to live.
 *
 * Note: falling into a pit never reaches this class — level falls emit
 * PLAYER_FELL, which the scene routes to a respawn only.
 */
export class LivesManager {
  maxLives: number;
  private _lives: number;
  private _bus: EventBus | null;

  constructor({ lives = 3, maxLives = lives, bus = null }: LivesManagerOptions = {}) {
    this.maxLives = maxLives;
    this._lives = Math.min(lives, maxLives);
    this._bus = bus;
  }

  get lives(): number {
    return this._lives;
  }

  get isDepleted(): boolean {
    return this._lives <= 0;
  }

  /** @returns true if a heart was actually removed */
  loseHeart(): boolean {
    if (this._lives <= 0) return false;
    this._lives -= 1;
    this._emit();
    if (this._lives === 0) {
      this._bus?.emit(Events.LIVES_DEPLETED, {});
    }
    return true;
  }

  /** Back to full hearts (new attempt on the same phase). */
  reset(): void {
    this._lives = this.maxLives;
    this._emit();
  }

  private _emit(): void {
    this._bus?.emit(Events.LIVES_CHANGED, { lives: this._lives, maxLives: this.maxLives });
  }
}
