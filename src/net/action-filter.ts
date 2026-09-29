import type { StampedAction } from './signaling-socket.js';

/**
 * A command older than this when it reaches the TV is dropped: a jump that
 * late would land on the wrong obstacle. Initial value for real-device trials
 * (docs/19 §4 P0.5); tune from recorded sessions.
 */
export const MAX_ACTION_DELAY_MS = 1000;
/** Offset samples kept (beacons arrive about once a second, so roughly a minute). */
const CLOCK_WINDOW = 64;

/**
 * Drops movement commands that belong to an earlier controller connection,
 * that were already seen, or that arrived too late (docs/19 §4 P0.5).
 *
 *  - The server stamps each action with the room's controller generation,
 *    bumped on every (re)join; the phone numbers its own sends (`seq`).
 *  - The phone also stamps its own monotonic send time (`sentAt`). The two
 *    clocks are never compared as if synchronised: each sample of
 *    `receivedAt - sentAt` is the clock difference plus that message's
 *    transit time, so the smallest recent sample estimates the difference
 *    plus the fastest transit. A command's extra delay over that fastest
 *    transit is its lateness. Health beacons feed the estimate every second;
 *    it restarts with every generation (a new phone page has a new clock).
 *  - `armAt` marks when the match started accepting commands: anything the
 *    phone sent before that moment (by the same estimate) is dropped, so a
 *    jump made during a pause never lands after "Continuar".
 *
 * Commands without `sentAt` only get the generation/sequence checks.
 */
export class ActionFilter {
  private _generation = 0;
  private _lastSeq = 0;
  private _offsets: number[] = [];
  private _armedAt = -Infinity;
  private _maxDelayMs: number;

  constructor({ maxDelayMs = MAX_ACTION_DELAY_MS }: { maxDelayMs?: number } = {}) {
    this._maxDelayMs = maxDelayMs;
  }

  get generation(): number {
    return this._generation;
  }

  /**
   * A newer controller connection was announced (join snapshot, presence,
   * beacon or command).
   * @returns whether the generation changed
   */
  observeGeneration(generation: number): boolean {
    if (!Number.isSafeInteger(generation) || generation <= this._generation) return false;
    this._generation = generation;
    this._lastSeq = 0;
    this._offsets = [];
    return true;
  }

  /** A beacon's send time, to refine the clock estimate. Ignored unless it is from the current generation. */
  observeClock(generation: number, sentAt: number | null | undefined, receivedAt: number): void {
    if (generation !== this._generation || !isTime(sentAt)) return;
    this._pushOffset(receivedAt - sentAt);
  }

  /** Commands sent (by the phone's clock, translated) before `now` on this device's clock are dropped from here on. */
  armAt(now: number): void {
    this._armedAt = now;
  }

  /** Forget everything seen so far (session lost or restarted). */
  reset(): void {
    this._generation = 0;
    this._lastSeq = 0;
    this._offsets = [];
    this._armedAt = -Infinity;
  }

  accept(action: StampedAction, receivedAt: number): boolean {
    if (!Number.isSafeInteger(action.generation) || action.generation < this._generation) return false;
    this.observeGeneration(action.generation);
    if (action.seq !== null && action.seq !== undefined) {
      if (!Number.isSafeInteger(action.seq) || action.seq <= this._lastSeq) return false;
      this._lastSeq = action.seq;
    }
    if (!isTime(action.sentAt)) return true;
    const offset = receivedAt - action.sentAt;
    this._pushOffset(offset);
    const minOffset = Math.min(...this._offsets);
    const delay = offset - minOffset;
    if (delay > this._maxDelayMs) return false;
    // Send moment on this device's clock, up to the fastest transit seen.
    return action.sentAt + minOffset >= this._armedAt;
  }

  private _pushOffset(offset: number): void {
    if (!Number.isFinite(offset)) return;
    this._offsets.push(offset);
    if (this._offsets.length > CLOCK_WINDOW) this._offsets.shift();
  }
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
