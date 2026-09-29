import { describe, it, expect, vi } from 'vitest';
import { MotionSession, MIN_CALIBRATION_SAMPLES } from './motion-session.js';

function makeTarget() {
  const listeners = new Set();
  return {
    addEventListener: vi.fn((type, fn) => listeners.add(fn)),
    removeEventListener: vi.fn((type, fn) => listeners.delete(fn)),
    fire(a, timeStamp = 0) {
      for (const fn of [...listeners]) fn({ accelerationIncludingGravity: a, timeStamp, rotationRate: null, interval: 16 });
    },
    get count() {
      return listeners.size;
    },
  };
}

const REST = { x: 0, y: 9.81, z: 0 };

function setup(options = {}) {
  let now = 0;
  let pendingTimer = null;
  const target = makeTarget();
  const session = new MotionSession({
    target,
    now: () => now,
    setTimeoutFn: (fn) => {
      pendingTimer = fn;
      return 1;
    },
    ...options,
  });
  return {
    target,
    session,
    tick(ms) {
      now += ms;
    },
    endCalibration() {
      pendingTimer?.();
      pendingTimer = null;
    },
  };
}

describe('MotionSession', () => {
  it('keeps a single devicemotion listener however many times it is started (retry after errors)', () => {
    const { session, target } = setup();
    for (let i = 0; i < 20; i += 1) session.start();
    expect(target.addEventListener).toHaveBeenCalledTimes(1);
    expect(target.count).toBe(1);
    session.stop();
    expect(target.count).toBe(0);
  });

  it('reports "none" before any valid sample, "ok" when fresh, "stale" after silence', () => {
    const { session, target, tick } = setup();
    session.start();
    expect(session.health()).toBe('none');
    target.fire(REST);
    expect(session.health()).toBe('ok');
    tick(1001);
    expect(session.health()).toBe('stale');
  });

  it('ignores non-finite readings', () => {
    const { session, target } = setup();
    session.start();
    target.fire({ x: null, y: 9.8, z: 0 });
    target.fire({ x: Number.NaN, y: 9.8, z: 0 });
    target.fire(null);
    expect(session.sampleCount).toBe(0);
    expect(session.health()).toBe('none');
  });

  it('calibration with zero samples fails — never "listening" on a silent sensor', async () => {
    const { session, endCalibration } = setup();
    const result = session.calibrate(1500);
    endCalibration();
    await expect(result).resolves.toMatchObject({ ok: false, problem: 'no-samples' });
  });

  it('calibration needs a minimum number of samples', async () => {
    const { session, target, endCalibration } = setup();
    const result = session.calibrate(1500);
    for (let i = 0; i < MIN_CALIBRATION_SAMPLES - 1; i += 1) target.fire(REST);
    endCalibration();
    await expect(result).resolves.toMatchObject({ ok: false, problem: 'too-few-samples' });
  });

  it('calibration rejects a rest far from gravity', async () => {
    const { session, target, endCalibration } = setup();
    const result = session.calibrate(1500);
    for (let i = 0; i < 20; i += 1) target.fire({ x: 0, y: 0.5, z: 0 });
    endCalibration();
    await expect(result).resolves.toMatchObject({ ok: false, problem: 'implausible' });
  });

  it('routes samples to calibration first, then to onSample', async () => {
    const onSample = vi.fn();
    const { session, target, endCalibration } = setup({ onSample });
    const result = session.calibrate(1500);
    for (let i = 0; i < 20; i += 1) target.fire(REST);
    endCalibration();
    await expect(result).resolves.toMatchObject({ ok: true });
    expect(onSample).not.toHaveBeenCalled();
    target.fire(REST);
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it('reports a gap between samples so the detector can forget stale state', () => {
    const onGap = vi.fn();
    const { session, target, tick } = setup({ onGap });
    session.start();
    target.fire(REST);
    tick(100);
    target.fire(REST);
    expect(onGap).not.toHaveBeenCalled();
    tick(2000);
    target.fire(REST);
    expect(onGap).toHaveBeenCalledWith(2000);
  });
});
