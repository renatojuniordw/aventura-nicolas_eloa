const GRAVITY_MPS2 = 9.81;

export interface AccelerationSample {
  x: number;
  y: number;
  z: number;
}

export interface JumpDetectorThresholds {
  /** Freefall triggers once magnitude drops below (calibrated rest - this), in g. */
  freefallDeltaG: number;
  /** Impact (landing) triggers once magnitude rises above (calibrated rest + this), in g. */
  impactDeltaG: number;
  /** A freefall shorter than this is noise (a bump, not airtime). */
  minFreefallMs: number;
  /** A freefall longer than this was never a jump — abort back to idle. */
  maxFreefallMs: number;
  /** Minimum gap between two detected jumps, absorbs impact vibration. */
  cooldownMs: number;
  /**
   * Takeoff (push-off) spike, in g above rest. A freefall that follows such a
   * spike fires the jump as soon as the phone leaves the ground, instead of
   * waiting for the landing. 0 turns this off (landing-only detection).
   */
  takeoffDeltaG: number;
  /** The push-off spike must have happened at most this long before the freefall began. */
  takeoffWindowMs: number;
}

// Starting point only — docs/12-controle-por-celular.md §10 flags these as
// needing fine-tuning against a real child; exposed via JumpDetector's
// constructor so a debug panel (?debug=1) can override them live.
export const DEFAULT_JUMP_DETECTOR_THRESHOLDS: JumpDetectorThresholds = Object.freeze({
  freefallDeltaG: 0.4,
  impactDeltaG: 0.7,
  minFreefallMs: 100,
  maxFreefallMs: 750,
  cooldownMs: 300,
  takeoffDeltaG: 0.4,
  takeoffWindowMs: 250,
});

/** Magnitude of the acceleration vector, in g — orientation-independent (§5). */
export function magnitudeInG({ x, y, z }: AccelerationSample): number {
  return Math.sqrt(x * x + y * y + z * z) / GRAVITY_MPS2;
}

type DetectorState = 'idle' | 'freefall';

/** Shape of the last confirmed jump — logged to tell real jumps from false positives (docs/12 §10). */
export interface JumpInfo {
  freefallMs: number;
  /** Deepest magnitude reached during freefall, in g. */
  minFreefallG: number;
  /** Magnitude of the sample that confirmed the landing, in g. Null until an early (takeoff) jump lands. */
  impactG: number | null;
  /** Whether it fired on the way up (takeoff) or on the way down (landing). */
  trigger: 'takeoff' | 'landing';
  /** Push-off spike magnitude that armed a takeoff trigger, in g. Null when none was seen. */
  takeoffG: number | null;
}

export interface JumpDetectorOptions {
  /**
   * Re-estimates the resting magnitude from quiet idle stretches, so a phone
   * that slides on the child's body doesn't shift every threshold with it.
   */
  trackRest?: boolean;
}

/** Idle stretch length that must stay quiet before it counts as a new rest reading. */
const REST_WINDOW_MS = 1000;
/** A stretch whose max-min spread exceeds this is movement, not rest. */
const REST_QUIET_RANGE_G = 0.2;
/** A reading further than this from the current rest is a different state (e.g. stuck low-g), not drift. */
const REST_MAX_DRIFT_G = 0.25;
/** Share of the gap to the new reading applied per accepted window. */
const REST_BLEND = 0.5;

/**
 * Consecutive below-threshold samples required before committing to
 * `freefall`. A single noisy dip (the phone jostling during autorun) used to
 * start the freefall clock on its own, "stealing" part of maxFreefallMs
 * before the real jump's impact ever arrived — seen in the field as impacts
 * that landed a hair past the abort window. At a typical devicemotion rate
 * this costs one extra sample (~16ms), negligible next to minFreefallMs.
 */
const FREEFALL_CONFIRM_SAMPLES = 2;

/**
 * Pure freefall-then-impact jump detector, extracted from the page so it can
 * be fed a recorded fixture in tests instead of a real `devicemotion`
 * listener (docs/12 §10, "Testabilidade do algoritmo de detecção sem
 * hardware"). `src/controle/main.ts` is the only caller that touches the
 * actual sensor.
 */
export class JumpDetector {
  private _thresholds: JumpDetectorThresholds;
  private _restMagnitude = 1; // 1g (gravity at rest) until calibrate() runs
  private _state: DetectorState = 'idle';
  private _freefallStart = 0;
  private _lastJumpAt = -Infinity;
  private _belowThresholdStreak = 0;
  private _pendingFreefallStart: number | null = null;
  private _pendingMinG = Infinity;
  private _minFreefallG = Infinity;
  private _lastJump: JumpInfo | null = null;
  private _spikeAt = -Infinity;
  private _spikeG = 0;
  private _firedThisFlight = false;
  private _trackRest: boolean;
  private _restUpdates = 0;
  private _windowStart: number | null = null;
  private _windowSum = 0;
  private _windowCount = 0;
  private _windowMin = Infinity;
  private _windowMax = -Infinity;

  constructor(
    thresholds: JumpDetectorThresholds = DEFAULT_JUMP_DETECTOR_THRESHOLDS,
    options: JumpDetectorOptions = {},
  ) {
    this._thresholds = thresholds;
    this._trackRest = options.trackRest ?? false;
  }

  /**
   * Reads the resting magnitude from a short calibration window so the
   * thresholds adapt to how this specific phone sits on this specific child
   * (§5), instead of assuming a universal fixed value.
   */
  calibrate(samples: AccelerationSample[]): void {
    if (samples.length === 0) return;
    const total = samples.reduce((sum, sample) => sum + magnitudeInG(sample), 0);
    this._restMagnitude = total / samples.length;
  }

  get state(): DetectorState {
    return this._state;
  }

  get restMagnitude(): number {
    return this._restMagnitude;
  }

  /** Details of the most recent confirmed jump, or null before the first one. */
  get lastJump(): JumpInfo | null {
    return this._lastJump;
  }

  /** How many times trackRest has adjusted restMagnitude — lets a caller log each change. */
  get restUpdates(): number {
    return this._restUpdates;
  }

  get freefallThreshold(): number {
    return this._restMagnitude - this._thresholds.freefallDeltaG;
  }

  get impactThreshold(): number {
    return this._restMagnitude + this._thresholds.impactDeltaG;
  }

  /** @returns true exactly on the sample that confirms a completed jump. */
  feed(sample: AccelerationSample, timestampMs: number): boolean {
    const magnitude = magnitudeInG(sample);
    const { minFreefallMs, maxFreefallMs, cooldownMs } = this._thresholds;

    if (this._state === 'idle') {
      if (magnitude < this.freefallThreshold) {
        if (this._pendingFreefallStart === null) this._pendingFreefallStart = timestampMs;
        this._pendingMinG = Math.min(this._pendingMinG, magnitude);
        this._belowThresholdStreak += 1;
        this._resetRestWindow();
        if (this._belowThresholdStreak >= FREEFALL_CONFIRM_SAMPLES) {
          this._state = 'freefall';
          this._freefallStart = this._pendingFreefallStart;
          this._minFreefallG = this._pendingMinG;
          this._belowThresholdStreak = 0;
          this._pendingFreefallStart = null;
          this._pendingMinG = Infinity;
          this._firedThisFlight = false;
          return this._tryTakeoffFire(timestampMs);
        }
      } else {
        this._belowThresholdStreak = 0;
        this._pendingFreefallStart = null;
        this._pendingMinG = Infinity;
        this._noteTakeoffSpike(magnitude, timestampMs);
        this._trackRestSample(magnitude, timestampMs);
      }
      return false;
    }

    // this._state === 'freefall'
    const elapsed = timestampMs - this._freefallStart;
    this._minFreefallG = Math.min(this._minFreefallG, magnitude);

    if (magnitude > this.impactThreshold) {
      this._state = 'idle';
      this._resetRestWindow();
      if (this._firedThisFlight) {
        // Already fired on takeoff — the landing only completes the record.
        this._firedThisFlight = false;
        if (this._lastJump) this._lastJump = { ...this._lastJump, freefallMs: elapsed, impactG: magnitude };
        return false;
      }
      const longEnough = elapsed > minFreefallMs;
      const pastCooldown = timestampMs - this._lastJumpAt > cooldownMs;
      if (longEnough && pastCooldown) {
        this._lastJumpAt = timestampMs;
        this._lastJump = {
          freefallMs: elapsed,
          minFreefallG: this._minFreefallG,
          impactG: magnitude,
          trigger: 'landing',
          takeoffG: null,
        };
        return true;
      }
      return false;
    }

    if (elapsed > maxFreefallMs) {
      this._state = 'idle'; // was never a real jump — abort
      this._firedThisFlight = false;
    }
    return false;
  }

  reset(): void {
    this._state = 'idle';
    this._freefallStart = 0;
    this._belowThresholdStreak = 0;
    this._pendingFreefallStart = null;
    this._pendingMinG = Infinity;
    this._spikeAt = -Infinity;
    this._firedThisFlight = false;
    this._resetRestWindow();
  }

  /** Remembers the most recent push-off spike so a freefall right after it can fire early. */
  private _noteTakeoffSpike(magnitude: number, timestampMs: number): void {
    const { takeoffDeltaG, takeoffWindowMs } = this._thresholds;
    if (!(takeoffDeltaG > 0) || magnitude <= this._restMagnitude + takeoffDeltaG) return;
    const sameSpike = timestampMs - this._spikeAt <= takeoffWindowMs;
    this._spikeG = sameSpike ? Math.max(this._spikeG, magnitude) : magnitude;
    this._spikeAt = timestampMs;
  }

  /** Fires on the sample that confirms freefall, if a push-off spike just preceded it. */
  private _tryTakeoffFire(timestampMs: number): boolean {
    const { takeoffDeltaG, takeoffWindowMs, cooldownMs } = this._thresholds;
    if (!(takeoffDeltaG > 0)) return false; // also covers thresholds saved before this field existed
    if (this._freefallStart - this._spikeAt > takeoffWindowMs) return false;
    if (timestampMs - this._lastJumpAt <= cooldownMs) return false;
    this._lastJumpAt = timestampMs;
    this._firedThisFlight = true;
    this._lastJump = {
      freefallMs: timestampMs - this._freefallStart,
      minFreefallG: this._minFreefallG,
      impactG: null,
      trigger: 'takeoff',
      takeoffG: this._spikeG,
    };
    this._spikeAt = -Infinity;
    return true;
  }

  private _resetRestWindow(): void {
    this._windowStart = null;
    this._windowSum = 0;
    this._windowCount = 0;
    this._windowMin = Infinity;
    this._windowMax = -Infinity;
  }

  private _trackRestSample(magnitude: number, timestampMs: number): void {
    if (!this._trackRest) return;
    if (this._windowStart === null) this._windowStart = timestampMs;
    this._windowSum += magnitude;
    this._windowCount += 1;
    this._windowMin = Math.min(this._windowMin, magnitude);
    this._windowMax = Math.max(this._windowMax, magnitude);
    if (timestampMs - this._windowStart < REST_WINDOW_MS) return;

    const quiet = this._windowMax - this._windowMin <= REST_QUIET_RANGE_G;
    const mean = this._windowSum / this._windowCount;
    if (quiet && Math.abs(mean - this._restMagnitude) <= REST_MAX_DRIFT_G) {
      this._restMagnitude += (mean - this._restMagnitude) * REST_BLEND;
      this._restUpdates += 1;
    }
    this._resetRestWindow();
  }
}
