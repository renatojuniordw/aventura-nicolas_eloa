import type { StampedAction } from './signaling-socket.js';

/**
 * Drops movement commands that belong to an earlier controller connection or
 * that were already seen (docs/19 §4 P0.5). The server stamps each action with
 * the room's controller generation, bumped on every (re)join; the phone numbers
 * its own sends. No clocks are compared: the two devices are not synchronised.
 */
export class ActionFilter {
  private _generation = 0;
  private _lastSeq = 0;

  get generation(): number {
    return this._generation;
  }

  /** A newer controller connection was announced (join snapshot or presence). */
  observeGeneration(generation: number): void {
    if (!Number.isSafeInteger(generation) || generation <= this._generation) return;
    this._generation = generation;
    this._lastSeq = 0;
  }

  /** Forget everything seen so far (session lost or restarted). */
  reset(): void {
    this._generation = 0;
    this._lastSeq = 0;
  }

  accept(action: StampedAction): boolean {
    if (!Number.isSafeInteger(action.generation) || action.generation < this._generation) return false;
    this.observeGeneration(action.generation);
    if (action.seq === null || action.seq === undefined) return true;
    if (!Number.isSafeInteger(action.seq) || action.seq <= this._lastSeq) return false;
    this._lastSeq = action.seq;
    return true;
  }
}
