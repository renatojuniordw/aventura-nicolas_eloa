import type { WordEntry } from '../content/word-bank.js';

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

  constructor(
    readonly word: WordEntry,
    readonly trail: TrailPosition = { position: 1, total: 1 },
    elapsed = 0,
    /** Earlier word completions in the current short journey; never persisted as mastery. */
    readonly journey: readonly string[] = [],
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

  /** Advances the expected-letter pointer; true once the whole word is spelled. */
  collectLetter(): boolean {
    this.currentLetterIndex += 1;
    return this.currentLetterIndex >= this.currentWordLetters.length;
  }
}
