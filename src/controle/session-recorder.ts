import type { JumpInfo } from './jump-detector.js';

export interface RecordedSample {
  t: number;
  x: number;
  y: number;
  z: number;
  /** Gyroscope rate in deg/s (DeviceMotionEvent.rotationRate), when the device reports it. */
  rx?: number;
  ry?: number;
  rz?: number;
  /** Handler time minus event time, in ms — how late the browser delivered this sample. */
  lagMs?: number;
}

export interface RotationSample {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

/** A human-labelled ground-truth event, e.g. the parent tapping "pulei agora". */
export interface RecordedMarker {
  t: number;
  kind: string;
}

/** A jump the live detector confirmed, with the shape data needed to judge it offline. */
export interface RecordedDetection extends JumpInfo {
  t: number;
}

export interface SamplingStats {
  medianDtMs: number;
  effectiveHz: number;
  maxGapMs: number;
  maxLagMs: number | null;
}

/** ~5-6 minutes at a typical 60Hz devicemotion rate — plenty for one tuning session. */
const MAX_SAMPLES = 20_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

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
  private _markers: RecordedMarker[] = [];
  private _detections: RecordedDetection[] = [];

  push(
    sample: { x: number; y: number; z: number },
    t: number,
    rotation?: RotationSample | null,
    lagMs?: number,
  ): void {
    if (this._samples.length >= MAX_SAMPLES) return;
    const recorded: RecordedSample = { t, x: sample.x, y: sample.y, z: sample.z };
    if (rotation && rotation.alpha != null && rotation.beta != null && rotation.gamma != null) {
      recorded.rx = rotation.alpha;
      recorded.ry = rotation.beta;
      recorded.rz = rotation.gamma;
    }
    if (lagMs !== undefined) recorded.lagMs = lagMs;
    this._samples.push(recorded);
  }

  /** Ground truth: replay compares live/offline detections against these. */
  mark(kind: string, t: number): void {
    this._markers.push({ t, kind });
  }

  logDetection(t: number, info: JumpInfo): void {
    this._detections.push({ t, ...info });
  }

  get sampleCount(): number {
    return this._samples.length;
  }

  get markerCount(): number {
    return this._markers.length;
  }

  /** Sampling rate and delivery-delay figures — makes recordings from different phones comparable. */
  samplingStats(): SamplingStats | null {
    if (this._samples.length < 2) return null;
    const dts: number[] = [];
    for (let i = 1; i < this._samples.length; i += 1) dts.push(this._samples[i].t - this._samples[i - 1].t);
    const medianDtMs = median(dts);
    const lags = this._samples.flatMap((s) => (s.lagMs === undefined ? [] : [s.lagMs]));
    return {
      medianDtMs,
      effectiveHz: medianDtMs > 0 ? 1000 / medianDtMs : 0,
      maxGapMs: Math.max(...dts),
      maxLagMs: lags.length > 0 ? Math.max(...lags) : null,
    };
  }

  toJSON(meta: Record<string, unknown> = {}): string {
    return JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        sampleCount: this._samples.length,
        sampling: this.samplingStats(),
        ...meta,
        markers: this._markers,
        detections: this._detections,
        samples: this._samples,
      },
      null,
      2,
    );
  }
}
