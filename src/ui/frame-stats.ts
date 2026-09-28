/**
 * Opt-in frame-time sampler for the support screen (docs/18 §10). Nothing runs
 * until `start()`; `stop()` cancels its only animation frame and drops the
 * samples. Kept in memory for this session only, never sent anywhere.
 */
export interface FrameSummary {
  frames: number;
  averageMs: number;
  p95Ms: number;
  /** Frames slower than two 60 Hz frames (a visible hitch). */
  slowFrames: number;
}

export interface FrameSampler {
  readonly running: boolean;
  start(): void;
  stop(): void;
  summary(): FrameSummary | null;
}

interface FrameSamplerOptions {
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (id: number) => void;
  /** Most recent deltas kept (a ring), ~10 s at 60 Hz by default. */
  capacity?: number;
}

const SLOW_FRAME_MS = 1000 / 30;

export function createFrameSampler({
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
  capacity = 600,
}: FrameSamplerOptions = {}): FrameSampler {
  let deltas: number[] = [];
  let last: number | null = null;
  let frameId: number | null = null;

  const tick = (time: number) => {
    if (last !== null) {
      deltas.push(time - last);
      if (deltas.length > capacity) deltas.shift();
    }
    last = time;
    frameId = requestFrame(tick);
  };

  return {
    get running() {
      return frameId !== null;
    },
    start() {
      if (frameId !== null) return;
      last = null;
      frameId = requestFrame(tick);
    },
    stop() {
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      last = null;
      deltas = [];
    },
    summary() {
      if (!deltas.length) return null;
      const sorted = [...deltas].sort((a, b) => a - b);
      const total = deltas.reduce((sum, value) => sum + value, 0);
      return {
        frames: deltas.length,
        averageMs: total / deltas.length,
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!,
        slowFrames: deltas.filter((value) => value > SLOW_FRAME_MS).length,
      };
    },
  };
}
