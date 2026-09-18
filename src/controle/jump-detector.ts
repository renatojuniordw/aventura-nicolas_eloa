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
});

/** Magnitude of the acceleration vector, in g — orientation-independent (§5). */
export function magnitudeInG({ x, y, z }: AccelerationSample): number {
  return Math.sqrt(x * x + y * y + z * z) / GRAVITY_MPS2;
}

type DetectorState = 'idle' | 'freefall';

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

  constructor(thresholds: JumpDetectorThresholds = DEFAULT_JUMP_DETECTOR_THRESHOLDS) {
    this._thresholds = thresholds;
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
        this._state = 'freefall';
        this._freefallStart = timestampMs;
      }
      return false;
    }

    // this._state === 'freefall'
    const elapsed = timestampMs - this._freefallStart;

    if (magnitude > this.impactThreshold) {
      this._state = 'idle';
      const longEnough = elapsed > minFreefallMs;
      const pastCooldown = timestampMs - this._lastJumpAt > cooldownMs;
      if (longEnough && pastCooldown) {
        this._lastJumpAt = timestampMs;
        return true;
      }
      return false;
    }

    if (elapsed > maxFreefallMs) {
      this._state = 'idle'; // was never a real jump — abort
    }
    return false;
  }

  reset(): void {
    this._state = 'idle';
    this._freefallStart = 0;
  }
}
