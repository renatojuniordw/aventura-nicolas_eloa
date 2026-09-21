import {
  JumpDetector,
  DEFAULT_JUMP_DETECTOR_THRESHOLDS,
  type JumpDetectorThresholds,
  type JumpInfo,
} from './jump-detector.js';
import type { RecordedMarker, RecordedSample } from './session-recorder.js';

/** Shape of the JSON that the `?debug=1` panel downloads. */
export interface SessionRecording {
  samples: RecordedSample[];
  markers?: RecordedMarker[];
  /** Event time at which calibration ended; earlier samples only calibrate, never feed the detector. */
  calibrationEndT?: number;
}

export interface ReplayOptions {
  trackRest?: boolean;
  /** Used only when the recording has no calibrationEndT. */
  calibrationMs?: number;
}

export interface ReplayDetection {
  t: number;
  info: JumpInfo;
  /** Peak gyroscope magnitude (deg/s) around the jump, or null if the phone reported none. */
  rotationPeak: number | null;
}

export interface Score {
  hits: number;
  falsePositives: number;
  misses: number;
  precision: number;
  recall: number;
  f1: number;
  /** Per detection, in order: whether it matched a ground-truth marker. */
  matched: boolean[];
}

export interface SweepResult {
  thresholds: JumpDetectorThresholds;
  detections: ReplayDetection[];
  score: Score;
}

const DEFAULT_CALIBRATION_MS = 1500;
/** Extra look-back before the freefall start when measuring rotation around a jump. */
const ROTATION_LOOKBACK_MS = 200;
/** A human tapping "pulei agora" lags the landing; this is how far apart a tap and a detection may be. */
export const DEFAULT_MATCH_TOLERANCE_MS = 1500;

function rotationMagnitude(sample: RecordedSample): number | null {
  if (sample.rx === undefined || sample.ry === undefined || sample.rz === undefined) return null;
  return Math.sqrt(sample.rx ** 2 + sample.ry ** 2 + sample.rz ** 2);
}

function rotationPeakBetween(samples: RecordedSample[], from: number, to: number): number | null {
  let peak: number | null = null;
  for (const sample of samples) {
    if (sample.t < from || sample.t > to) continue;
    const magnitude = rotationMagnitude(sample);
    if (magnitude !== null && (peak === null || magnitude > peak)) peak = magnitude;
  }
  return peak;
}

/** Runs a recorded session through a fresh JumpDetector, the way the live page would have. */
export function replaySession(
  recording: SessionRecording,
  thresholds: JumpDetectorThresholds = DEFAULT_JUMP_DETECTOR_THRESHOLDS,
  options: ReplayOptions = {},
): ReplayDetection[] {
  const { samples } = recording;
  if (samples.length === 0) return [];

  const calibrationEnd =
    recording.calibrationEndT ?? samples[0].t + (options.calibrationMs ?? DEFAULT_CALIBRATION_MS);
  const detector = new JumpDetector({ ...thresholds }, { trackRest: options.trackRest ?? false });
  detector.calibrate(samples.filter((s) => s.t < calibrationEnd));

  const detections: ReplayDetection[] = [];
  for (const sample of samples) {
    if (sample.t < calibrationEnd) continue;
    if (!detector.feed(sample, sample.t)) continue;
    const info = detector.lastJump as JumpInfo;
    detections.push({
      t: sample.t,
      info,
      rotationPeak: rotationPeakBetween(samples, sample.t - info.freefallMs - ROTATION_LOOKBACK_MS, sample.t),
    });
  }
  return detections;
}

/** Greedy nearest-marker matching, one marker per detection. Only 'jump' markers count. */
export function scoreDetections(
  detections: ReplayDetection[],
  markers: RecordedMarker[],
  toleranceMs: number = DEFAULT_MATCH_TOLERANCE_MS,
): Score {
  const jumpTimes = markers.filter((m) => m.kind === 'jump').map((m) => m.t);
  const used = new Array<boolean>(jumpTimes.length).fill(false);
  const matched = detections.map((detection) => {
    let best = -1;
    let bestDistance = Infinity;
    jumpTimes.forEach((t, i) => {
      const distance = Math.abs(t - detection.t);
      if (!used[i] && distance <= toleranceMs && distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    if (best >= 0) used[best] = true;
    return best >= 0;
  });

  const hits = matched.filter(Boolean).length;
  const falsePositives = detections.length - hits;
  const misses = jumpTimes.length - hits;
  const precision = detections.length > 0 ? hits / detections.length : 0;
  const recall = jumpTimes.length > 0 ? hits / jumpTimes.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { hits, falsePositives, misses, precision, recall, f1, matched };
}

/** Every combination of the listed values; unlisted thresholds keep their defaults. */
export function thresholdGrid(
  axes: Partial<Record<keyof JumpDetectorThresholds, number[]>>,
  base: JumpDetectorThresholds = DEFAULT_JUMP_DETECTOR_THRESHOLDS,
): JumpDetectorThresholds[] {
  let combos: JumpDetectorThresholds[] = [{ ...base }];
  for (const [key, values] of Object.entries(axes) as Array<[keyof JumpDetectorThresholds, number[]]>) {
    combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [key]: value })));
  }
  // minFreefallMs >= maxFreefallMs can never confirm a jump (see the debug panel clamp).
  return combos.filter((c) => c.minFreefallMs < c.maxFreefallMs);
}

/** Scores every threshold combination against the recording's markers, best first. */
export function sweepThresholds(
  recording: SessionRecording,
  grid: JumpDetectorThresholds[],
  options: ReplayOptions & { toleranceMs?: number } = {},
): SweepResult[] {
  const markers = recording.markers ?? [];
  return grid
    .map((thresholds) => {
      const detections = replaySession(recording, thresholds, options);
      return { thresholds, detections, score: scoreDetections(detections, markers, options.toleranceMs) };
    })
    .sort((a, b) => b.score.f1 - a.score.f1 || a.score.falsePositives - b.score.falsePositives);
}
