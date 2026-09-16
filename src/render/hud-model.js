/**
 * State behind the heads-up display: hearts, objective, feedback banner.
 *
 * Kept free of drawing so the rules (e.g. "feedback fades after N seconds")
 * are unit-testable. The HUD view reads this model and renders it.
 */

export const FeedbackKind = Object.freeze({
  NONE: 'none',
  CORRECT: 'correct',
  WRONG: 'wrong',
});

export class HudModel {
  constructor({
    objective = '',
    levelName = '',
    lives = 3,
    maxLives = 3,
    isSpeedrun = false,
    timer = 0,
    speedrunProgress = '',
  } = {}) {
    this.objective = objective;
    this.levelName = levelName;
    this.lives = lives;
    this.maxLives = maxLives;
    this.isSpeedrun = isSpeedrun;
    this.timer = timer;
    this.speedrunProgress = speedrunProgress;
    this.feedback = { kind: FeedbackKind.NONE, message: '', timer: 0 };
  }

  setTimer(timer) {
    this.timer = timer;
  }

  setSpeedrunProgress(progress) {
    this.speedrunProgress = progress;
  }

  setLives(lives) {
    this.lives = Math.max(0, lives);
  }

  setObjective(objective) {
    this.objective = objective;
  }

  /** @param {number} duration seconds the banner stays visible */
  showFeedback(kind, message, duration) {
    this.feedback = { kind, message, timer: duration };
  }

  clearFeedback() {
    this.feedback = { kind: FeedbackKind.NONE, message: '', timer: 0 };
  }

  get isFeedbackVisible() {
    return this.feedback.timer > 0 && this.feedback.kind !== FeedbackKind.NONE;
  }

  /** Hearts remaining as filled/empty flags, left to right. */
  get hearts() {
    return Array.from({ length: this.maxLives }, (_, index) => index < this.lives);
  }

  update(dt) {
    if (this.feedback.timer <= 0) return;
    this.feedback.timer = Math.max(0, this.feedback.timer - dt);
    if (this.feedback.timer === 0) {
      this.clearFeedback();
    }
  }
}
