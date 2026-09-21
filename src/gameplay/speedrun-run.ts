/** Minimum seconds between "letter comes later" hints while touching a future letter. */
export const FUTURE_HINT_INTERVAL = 1.2;

interface Point {
  x: number;
  y: number;
}

/**
 * Progress through one A-to-Z speedrun: which letter is current, the running
 * clock, and the pacing of the "that letter comes later" hint. Pure state and
 * rules — the scene turns its answers into feedback, effects and sound.
 */
export class SpeedrunRun {
  currentIndex = 0;
  elapsed: number;
  private _lastHintAt = -Infinity;

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

  /** True for a letter from a later segment, which must not be collectable yet. */
  isAhead(item: { segmentIndex?: number }): boolean {
    return item.segmentIndex != null && item.segmentIndex > this.currentIndex;
  }

  /**
   * The touched future letter stays overlapped for many frames: true at most
   * once per hint window, so the caller shows the hint once, not every frame.
   */
  claimFutureHint(): boolean {
    if (this.elapsed - this._lastHintAt < FUTURE_HINT_INTERVAL) return false;
    this._lastHintAt = this.elapsed;
    return true;
  }

  /** Moves on to the next letter; false (and no change) when already on the last. */
  advance(): boolean {
    if (this.isOnLastLetter) return false;
    this.currentIndex += 1;
    return true;
  }
}
