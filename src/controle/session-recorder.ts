export interface RecordedSample {
  t: number;
  x: number;
  y: number;
  z: number;
  /** Gyroscope rate in deg/s (DeviceMotionEvent.rotationRate), when the device reports it. */
  rx?: number;
  ry?: number;
  rz?: number;
}

export interface RotationSample {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

/** ~5-6 minutes at a typical 60Hz devicemotion rate — plenty for one tuning session. */
const MAX_SAMPLES = 20_000;

/**
 * Buffers raw devicemotion samples during a `?debug=1` session so a real play
 * session can be replayed offline against different JumpDetector thresholds
 * (the same way jump-detector.test.js replays a synthetic fixture), instead
 * of re-testing physically on the child's phone every time a threshold
 * changes. Pure and side-effect free — the page owns turning this into a
 * downloadable file.
 */
export class SessionRecorder {
  private _samples: RecordedSample[] = [];

  push(sample: { x: number; y: number; z: number }, t: number, rotation?: RotationSample | null): void {
    if (this._samples.length >= MAX_SAMPLES) return;
    const recorded: RecordedSample = { t, x: sample.x, y: sample.y, z: sample.z };
    if (rotation && rotation.alpha != null && rotation.beta != null && rotation.gamma != null) {
      recorded.rx = rotation.alpha;
      recorded.ry = rotation.beta;
      recorded.rz = rotation.gamma;
    }
    this._samples.push(recorded);
  }

  get sampleCount(): number {
    return this._samples.length;
  }

  toJSON(meta: Record<string, unknown> = {}): string {
    return JSON.stringify(
      { recordedAt: new Date().toISOString(), sampleCount: this._samples.length, ...meta, samples: this._samples },
      null,
      2,
    );
  }
}
