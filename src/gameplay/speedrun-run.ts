interface Point {
  x: number;
  y: number;
}

/**
 * Progress through one A-to-Z speedrun: which letter is current and the
 * running clock. Pure state and rules — the scene turns its answers into
 * feedback, effects and sound.
 */
export class SpeedrunRun {
  currentIndex = 0;
  elapsed: number;

  constructor(
    readonly alphabet: string[],
    readonly checkpoints?: Point[],
    elapsed = 0,
  ) {
    this.elapsed = elapsed;
  }

  get currentLetter(): string {
    return this.alphabet[this.currentIndex];
  }

  /** Checkpoint that goes with the current letter, if the course has one. */
  get currentCheckpoint(): Point | undefined {
    return this.checkpoints?.[this.currentIndex];
  }

  get isOnLastLetter(): boolean {
    return this.currentIndex >= this.alphabet.length - 1;
  }

  /** "3/26"-style label for the HUD. */
  get progressText(): string {
    return `${this.currentIndex + 1}/${this.alphabet.length}`;
  }

  tick(dt: number): void {
    this.elapsed += dt;
  }

  /** Moves on to the next letter; false (and no change) when already on the last. */
  advance(): boolean {
    if (this.isOnLastLetter) return false;
    this.currentIndex += 1;
    return true;
  }
}
