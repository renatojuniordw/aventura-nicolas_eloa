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

type FeedbackKindValue = (typeof FeedbackKind)[keyof typeof FeedbackKind];

interface Feedback {
  kind: FeedbackKindValue;
  message: string;
  timer: number;
}

interface HudModelOptions {
  objective?: string;
  levelName?: string;
  lives?: number;
  maxLives?: number;
  isSpeedrun?: boolean;
  timer?: number;
  speedrunProgress?: string;
}

export class HudModel {
  objective: string;
  levelName: string;
  lives: number;
  maxLives: number;
  isSpeedrun: boolean;
  timer: number;
  speedrunProgress: string;
  feedback: Feedback;

  constructor({
    objective = '',
    levelName = '',
    lives = 3,
    maxLives = 3,
    isSpeedrun = false,
    timer = 0,
    speedrunProgress = '',
  }: HudModelOptions = {}) {
    this.objective = objective;
    this.levelName = levelName;
    this.lives = lives;
    this.maxLives = maxLives;
    this.isSpeedrun = isSpeedrun;
    this.timer = timer;
    this.speedrunProgress = speedrunProgress;
    this.feedback = { kind: FeedbackKind.NONE, message: '', timer: 0 };
  }

  setTimer(timer: number): void {
    this.timer = timer;
  }

  setSpeedrunProgress(progress: string): void {
    this.speedrunProgress = progress;
  }

  setLives(lives: number): void {
    this.lives = Math.max(0, lives);
  }

  setObjective(objective: string): void {
    this.objective = objective;
  }

  /** @param duration seconds the banner stays visible */
  showFeedback(kind: FeedbackKindValue, message: string, duration: number): void {
    this.feedback = { kind, message, timer: duration };
  }

  clearFeedback(): void {
    this.feedback = { kind: FeedbackKind.NONE, message: '', timer: 0 };
  }

  get isFeedbackVisible(): boolean {
    return this.feedback.timer > 0 && this.feedback.kind !== FeedbackKind.NONE;
  }

  /** Hearts remaining as filled/empty flags, left to right. */
  get hearts(): boolean[] {
    return Array.from({ length: this.maxLives }, (_, index) => index < this.lives);
  }

  update(dt: number): void {
    if (this.feedback.timer <= 0) return;
    this.feedback.timer = Math.max(0, this.feedback.timer - dt);
    if (this.feedback.timer === 0) {
      this.clearFeedback();
    }
  }
}
