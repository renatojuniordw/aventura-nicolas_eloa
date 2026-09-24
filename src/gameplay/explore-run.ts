import type { WordEntry } from '../content/word-bank.js';

/** Minimum seconds between "not yet" hints while touching a blocked item. */
export const FUTURE_HINT_INTERVAL = 1.2;

interface Point {
  x: number;
  y: number;
}

interface ItemLike {
  segmentIndex?: number;
  kind?: string;
  type?: string;
  letterIndex?: number;
}

/**
 * Progress through one "Explorar" session: which word is current, whether its
 * discovery marker has been touched yet, and which of its letters comes next.
 * Pure state and rules — the scene turns its answers into narration, feedback
 * and celebration, exactly like `SpeedrunRun` does for the alphabet marathon.
 */
export class ExploreRun {
  currentWordIndex = 0;
  currentLetterIndex = 0;
  discovered = false;
  elapsed: number;
  private _lastHintAt = -Infinity;

  constructor(
    readonly words: WordEntry[],
    readonly checkpoints?: Point[],
    elapsed = 0,
  ) {
    this.elapsed = elapsed;
  }

  get currentWord(): WordEntry {
    return this.words[this.currentWordIndex];
  }

  get currentWordLetters(): string[] {
    return Array.from(this.currentWord.label);
  }

  get currentLetter(): string {
    return this.currentWordLetters[this.currentLetterIndex];
  }

  /** Checkpoint that goes with the current word, if the course has one. */
  get currentCheckpoint(): Point | undefined {
    return this.checkpoints?.[this.currentWordIndex];
  }

  get isOnLastWord(): boolean {
    return this.currentWordIndex >= this.words.length - 1;
  }

  /** "2/6"-style label for the HUD. */
  get progressText(): string {
    return `${this.currentWordIndex + 1}/${this.words.length}`;
  }

  tick(dt: number): void {
    this.elapsed += dt;
  }

  /**
   * True when `item` must not be collectable yet: it belongs to a later word,
   * or it is a letter of the current word touched before its discovery marker,
   * or a target letter that comes later than the one currently expected.
   */
  isAhead(item: ItemLike): boolean {
    if (item.segmentIndex == null) return false;
    if (item.segmentIndex > this.currentWordIndex) return true;
    if (item.segmentIndex < this.currentWordIndex) return false;
    if (item.kind !== 'letter') return false;
    if (!this.discovered) return true;
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

  /** Marks the current word's discovery marker as touched/narrated. */
  markDiscovered(): void {
    this.discovered = true;
  }

  /** Advances the expected-letter pointer; true once the whole word is spelled. */
  collectLetter(): boolean {
    this.currentLetterIndex += 1;
    return this.currentLetterIndex >= this.currentWordLetters.length;
  }

  /** Moves on to the next word; false (and no change) when already on the last. */
  advance(): boolean {
    if (this.isOnLastWord) return false;
    this.currentWordIndex += 1;
    this.currentLetterIndex = 0;
    this.discovered = false;
    return true;
  }
}
