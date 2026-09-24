import type { WordEntry } from '../content/word-bank.js';

/** Minimum seconds between "not yet" hints while touching a blocked item. */
export const FUTURE_HINT_INTERVAL = 1.2;

interface ItemLike {
  kind?: string;
  type?: string;
  letterIndex?: number;
}

interface TrailPosition {
  position: number;
  total: number;
}

/**
 * Progress through one "Explorar" phase: spelling a single word, letter by
 * letter, left to right. Pure state and rules — the scene turns its answers
 * into narration, feedback and celebration, exactly like `SpeedrunRun` does for
 * the alphabet marathon.
 */
export class ExploreRun {
  currentLetterIndex = 0;
  elapsed: number;
  private _lastHintAt = -Infinity;

  constructor(
    readonly word: WordEntry,
    readonly trail: TrailPosition = { position: 1, total: 1 },
    elapsed = 0,
  ) {
    this.elapsed = elapsed;
  }

  get currentWord(): WordEntry {
    return this.word;
  }

  get currentWordLetters(): string[] {
    return Array.from(this.word.label);
  }

  get currentLetter(): string {
    return this.currentWordLetters[this.currentLetterIndex];
  }

  /** "3/30"-style label for the HUD: where this word sits in the trail. */
  get progressText(): string {
    return `${this.trail.position}/${this.trail.total}`;
  }

  tick(dt: number): void {
    this.elapsed += dt;
  }

  /** True when `item` is a target letter that comes later than the one expected now. */
  isAhead(item: ItemLike): boolean {
    if (item.kind !== 'letter') return false;
    return item.type === 'target' && item.letterIndex != null && item.letterIndex > this.currentLetterIndex;
  }

  /**
   * The touched blocked item stays overlapped for many frames: true at most
   * once per hint window, so the caller shows the hint once, not every frame.
   */
  claimFutureHint(): boolean {
    if (this.elapsed - this._lastHintAt < FUTURE_HINT_INTERVAL) return false;
    this._lastHintAt = this.elapsed;
    return true;
  }

  /** Advances the expected-letter pointer; true once the whole word is spelled. */
  collectLetter(): boolean {
    this.currentLetterIndex += 1;
    return this.currentLetterIndex >= this.currentWordLetters.length;
  }
}
