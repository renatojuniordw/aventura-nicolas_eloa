import { Events } from '../core/event-bus.js';

/**
 * Owns the heart count. It is the single authority on losing lives, so a future
 * rule (extra life, shield) has one place to live.
 *
 * Note: falling into a pit never reaches this class — level falls emit
 * PLAYER_FELL, which the scene routes to a respawn only.
 */
export class LivesManager {
  constructor({ lives = 3, maxLives = lives, bus = null } = {}) {
    this.maxLives = maxLives;
    this._lives = Math.min(lives, maxLives);
    this._bus = bus;
  }

  get lives() {
    return this._lives;
  }

  get isDepleted() {
    return this._lives <= 0;
  }

  /**
   * @returns {boolean} true if a heart was actually removed
   */
  loseHeart() {
    if (this._lives <= 0) return false;
    this._lives -= 1;
    this._emit();
    if (this._lives === 0) {
      this._bus?.emit(Events.LIVES_DEPLETED, {});
    }
    return true;
  }

  /** Back to full hearts (new attempt on the same phase). */
  reset() {
    this._lives = this.maxLives;
    this._emit();
  }

  _emit() {
    this._bus?.emit(Events.LIVES_CHANGED, { lives: this._lives, maxLives: this.maxLives });
  }
}
