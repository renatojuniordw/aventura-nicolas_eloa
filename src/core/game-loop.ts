import { FIXED_STEP, MAX_STEPS_PER_FRAME } from './config.js';

export interface GameLoopOptions {
  update: (step: number) => void;
  render: () => void;
  step?: number;
  maxSteps?: number;
  now?: () => number;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

/**
 * Fixed-timestep game loop (accumulator pattern).
 *
 * The display supplies an irregular delta via requestAnimationFrame; the
 * simulation always advances in whole FIXED_STEP slices so physics stays
 * deterministic and independent of the monitor refresh rate. Rendering happens
 * once per displayed frame with the latest simulated state.
 *
 * Time source and frame scheduler are injected, which keeps `advance()` fully
 * unit-testable without a browser.
 */
export class GameLoop {
  private _update: (step: number) => void;
  private _render: () => void;
  private _step: number;
  private _maxSteps: number;
  private _now: () => number;
  private _requestFrame: (cb: FrameRequestCallback) => number;
  private _cancelFrame: (id: number) => void;

  private _accumulator = 0;
  private _lastTime = 0;
  private _frameId: number | null = null;
  private _running = false;

  constructor({
    update,
    render,
    step = FIXED_STEP,
    maxSteps = MAX_STEPS_PER_FRAME,
    now = () => performance.now(),
    requestFrame = (cb) => requestAnimationFrame(cb),
    cancelFrame = (id) => cancelAnimationFrame(id),
  }: GameLoopOptions) {
    if (typeof update !== 'function') throw new TypeError('update callback is required');
    if (typeof render !== 'function') throw new TypeError('render callback is required');

    this._update = update;
    this._render = render;
    this._step = step;
    this._maxSteps = maxSteps;
    this._now = now;
    this._requestFrame = requestFrame;
    this._cancelFrame = cancelFrame;
  }

  get running(): boolean {
    return this._running;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = this._now();
    this._accumulator = 0;
    this._scheduleNextFrame();
  }

  stop(): void {
    this._running = false;
    if (this._frameId !== null) {
      this._cancelFrame(this._frameId);
      this._frameId = null;
    }
  }

  private _scheduleNextFrame(): void {
    this._frameId = this._requestFrame(() => {
      if (!this._running) return;
      const time = this._now();
      const deltaSeconds = Math.max(0, (time - this._lastTime) / 1000);
      this._lastTime = time;
      this.advance(deltaSeconds);
      this._scheduleNextFrame();
    });
  }

  /**
   * Feed a real-time delta into the accumulator.
   * @returns how many fixed steps were simulated
   */
  advance(deltaSeconds: number): number {
    this._accumulator += deltaSeconds;
    let steps = 0;
    while (this._accumulator >= this._step && steps < this._maxSteps) {
      this._update(this._step);
      this._accumulator -= this._step;
      steps += 1;
    }
    // Guard against the "spiral of death" after a long stall (tab switch):
    // drop any remaining backlog instead of trying to catch up forever.
    if (steps === this._maxSteps) {
      this._accumulator = 0;
    }
    this._render();
    return steps;
  }
}
