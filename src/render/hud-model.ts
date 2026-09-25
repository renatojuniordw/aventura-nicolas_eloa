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
  /** False hides the clock in the progress badge (used by Explorar, which has no timer). */
  showTimer?: boolean;
}

export class HudModel {
  objective: string;
  levelName: string;
  lives: number;
  maxLives: number;
  isSpeedrun: boolean;
  timer: number;
  speedrunProgress: string;
  showTimer: boolean;
  feedback: Feedback;
  /** Letters of the word being spelled (Explorar); empty hides the board. */
  wordLetters: string[];
  revealedCount: number;
  /** Assisted support: which way the off-screen letter to find is, and its name; null hides the pointer. */
  targetPointer: { direction: 'left' | 'right'; label: string } | null;

  constructor({
    objective = '',
    levelName = '',
    lives = 3,
    maxLives = 3,
    isSpeedrun = false,
    timer = 0,
    speedrunProgress = '',
    showTimer = true,
  }: HudModelOptions = {}) {
    this.objective = objective;
    this.levelName = levelName;
    this.lives = lives;
    this.maxLives = maxLives;
    this.isSpeedrun = isSpeedrun;
    this.timer = timer;
    this.speedrunProgress = speedrunProgress;
    this.showTimer = showTimer;
    this.feedback = { kind: FeedbackKind.NONE, message: '', timer: 0 };
    this.wordLetters = [];
    this.revealedCount = 0;
    this.targetPointer = null;
  }

  setTargetPointer(pointer: { direction: 'left' | 'right'; label: string } | null): void {
    this.targetPointer = pointer;
  }

  setWordBoard(letters: readonly string[], revealedCount: number): void {
    this.wordLetters = [...letters];
    this.revealedCount = Math.max(0, Math.min(revealedCount, letters.length));
  }

  /** Word board slots left to right; `isNext` marks the letter to find now. */
  get boardSlots(): { char: string; revealed: boolean; isNext: boolean }[] {
    return this.wordLetters.map((char, index) => ({
      char,
      revealed: index < this.revealedCount,
      isNext: index === this.revealedCount,
    }));
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
