import { magnitudeInG, type AccelerationSample } from './jump-detector.js';

/**
 * The phone's single `devicemotion` subscription (docs/19 §4 P0.3).
 *
 * Before this, every "Toque para começar" added another anonymous listener,
 * so a retry after a pairing error ended with several detectors fed by the
 * same sensor. Here the listener is installed once and routed by mode:
 * samples go to the calibration buffer while calibrating and to `onSample`
 * afterwards. Only finite readings count. Health is measured from receipt
 * time: `none` before any valid sample, `stale` after `staleAfterMs` without
 * one — the page must never say "Pronto" on a silent sensor.
 */
export type SensorHealth = 'ok' | 'stale' | 'none';

export interface MotionReading {
  sample: AccelerationSample;
  /** `event.timeStamp`, to be resolved against `handlerNow` by the caller. */
  eventTimeStamp: number;
  handlerNow: number;
  rotationRate: DeviceMotionEventRotationRate | null;
  interval: number;
}

export interface CalibrationResult {
  ok: boolean;
  /** Why it failed, for the on-screen message. */
  problem: 'no-samples' | 'too-few-samples' | 'implausible' | null;
  samples: AccelerationSample[];
}

interface MotionTarget {
  addEventListener(type: 'devicemotion', listener: (event: DeviceMotionEvent) => void): void;
  removeEventListener(type: 'devicemotion', listener: (event: DeviceMotionEvent) => void): void;
}

interface MotionSessionOptions {
  target?: MotionTarget;
  now?: () => number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  staleAfterMs?: number;
  /** A pause longer than this between samples (page hidden, sensor throttled) resets the detector. */
  gapResetMs?: number;
  minCalibrationSamples?: number;
  onSample?: (reading: MotionReading) => void;
  /** Also fed during calibration — the optional session recorder wants every sample. */
  onAnySample?: (reading: MotionReading) => void;
  onGap?: (gapMs: number) => void;
}

export const SENSOR_STALE_AFTER_MS = 1000;
export const SENSOR_GAP_RESET_MS = 500;
export const MIN_CALIBRATION_SAMPLES = 10;
/** Resting magnitude must look like gravity; far outside it the reading is broken or the phone is moving a lot. */
const PLAUSIBLE_REST_G: [number, number] = [0.6, 1.5];

export function isValidReading(a: { x?: number | null; y?: number | null; z?: number | null } | null | undefined): a is AccelerationSample {
  return !!a && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
}

export class MotionSession {
  private _target: MotionTarget | null;
  private _now: () => number;
  private _setTimeout: (fn: () => void, ms: number) => unknown;
  private _staleAfterMs: number;
  private _gapResetMs: number;
  private _minSamples: number;
  private _onSample: (reading: MotionReading) => void;
  private _onAnySample: (reading: MotionReading) => void;
  private _onGap: (gapMs: number) => void;
  private _installed = false;
  private _calibration: AccelerationSample[] | null = null;
  private _lastSampleAt: number | null = null;
  private _count = 0;
  private _recent: number[] = [];
  private readonly _listener = (event: DeviceMotionEvent) => this._handle(event);

  constructor({
    target = typeof window === 'undefined' ? undefined : window,
    now = () => performance.now(),
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
    staleAfterMs = SENSOR_STALE_AFTER_MS,
    gapResetMs = SENSOR_GAP_RESET_MS,
    minCalibrationSamples = MIN_CALIBRATION_SAMPLES,
    onSample = () => {},
    onAnySample = () => {},
    onGap = () => {},
  }: MotionSessionOptions = {}) {
    this._target = target ?? null;
    this._now = now;
    this._setTimeout = setTimeoutFn;
    this._staleAfterMs = staleAfterMs;
    this._gapResetMs = gapResetMs;
    this._minSamples = minCalibrationSamples;
    this._onSample = onSample;
    this._onAnySample = onAnySample;
    this._onGap = onGap;
  }

  /** Installs the one listener. Idempotent. */
  start(): void {
    if (this._installed || !this._target) return;
    this._target.addEventListener('devicemotion', this._listener);
    this._installed = true;
  }

  stop(): void {
    if (!this._installed || !this._target) return;
    this._target.removeEventListener('devicemotion', this._listener);
    this._installed = false;
  }

  get listening(): boolean {
    return this._installed;
  }

  get calibrating(): boolean {
    return this._calibration !== null;
  }

  /** Valid samples since start. */
  get sampleCount(): number {
    return this._count;
  }

  /** Approximate valid samples per second over the last second. */
  get rateHz(): number {
    const cutoff = this._now() - 1000;
    return this._recent.filter((t) => t > cutoff).length;
  }

  /** Milliseconds since the last valid sample, or null before the first one. */
  get lastSampleAgeMs(): number | null {
    return this._lastSampleAt === null ? null : this._now() - this._lastSampleAt;
  }

  health(): SensorHealth {
    const age = this.lastSampleAgeMs;
    if (age === null) return 'none';
    return age > this._staleAfterMs ? 'stale' : 'ok';
  }

  /**
   * Collects `durationMs` of readings with the phone still, in its place of
   * use. Fails without enough valid samples or with an implausible rest.
   */
  calibrate(durationMs: number): Promise<CalibrationResult> {
    this.start();
    this._calibration = [];
    return new Promise((resolve) => {
      this._setTimeout(() => {
        const samples = this._calibration ?? [];
        this._calibration = null;
        if (samples.length === 0) return resolve({ ok: false, problem: 'no-samples', samples });
        if (samples.length < this._minSamples) return resolve({ ok: false, problem: 'too-few-samples', samples });
        const rest = samples.reduce((sum, s) => sum + magnitudeInG(s), 0) / samples.length;
        if (rest < PLAUSIBLE_REST_G[0] || rest > PLAUSIBLE_REST_G[1]) return resolve({ ok: false, problem: 'implausible', samples });
        resolve({ ok: true, problem: null, samples });
      }, durationMs);
    });
  }

  private _handle(event: DeviceMotionEvent): void {
    const a = event.accelerationIncludingGravity;
    if (!isValidReading(a)) return;
    const handlerNow = this._now();
    if (this._lastSampleAt !== null && handlerNow - this._lastSampleAt > this._gapResetMs) {
      this._onGap(handlerNow - this._lastSampleAt);
    }
    this._lastSampleAt = handlerNow;
    this._count += 1;
    this._recent.push(handlerNow);
    if (this._recent.length > 240) this._recent.splice(0, this._recent.length - 240);

    const sample = { x: a.x, y: a.y, z: a.z };
    const reading: MotionReading = {
      sample,
      eventTimeStamp: event.timeStamp,
      handlerNow,
      rotationRate: event.rotationRate,
      interval: event.interval,
    };
    this._onAnySample(reading);
    if (this._calibration) {
      this._calibration.push(sample);
      return;
    }
    this._onSample(reading);
  }
}
