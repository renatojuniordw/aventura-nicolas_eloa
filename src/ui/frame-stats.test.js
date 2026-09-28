import { describe, expect, it, vi } from 'vitest';
import { createFrameSampler } from './frame-stats.js';

function fakeFrames() {
  let callback = null;
  const request = vi.fn((cb) => { callback = cb; return 7; });
  const cancel = vi.fn();
  return { request, cancel, tick: (time) => callback?.(time) };
}

describe('createFrameSampler (docs/18 §10)', () => {
  it('does nothing until started and summarizes frame times', () => {
    const frames = fakeFrames();
    const sampler = createFrameSampler({ requestFrame: frames.request, cancelFrame: frames.cancel });
    expect(frames.request).not.toHaveBeenCalled();
    expect(sampler.summary()).toBeNull();

    sampler.start();
    sampler.start();
    expect(frames.request).toHaveBeenCalledTimes(1);
    [0, 16, 32, 48, 98].forEach((time) => frames.tick(time));
    const summary = sampler.summary();
    expect(summary.frames).toBe(4);
    expect(summary.averageMs).toBeCloseTo(24.5);
    expect(summary.p95Ms).toBe(50);
    expect(summary.slowFrames).toBe(1);
  });

  it('stop ends its only loop and drops the samples', () => {
    const frames = fakeFrames();
    const sampler = createFrameSampler({ requestFrame: frames.request, cancelFrame: frames.cancel });
    sampler.start();
    frames.tick(0);
    frames.tick(16);
    sampler.stop();
    expect(frames.cancel).toHaveBeenCalledWith(7);
    expect(sampler.running).toBe(false);
    expect(sampler.summary()).toBeNull();
  });

  it('keeps a bounded window', () => {
    const frames = fakeFrames();
    const sampler = createFrameSampler({ requestFrame: frames.request, cancelFrame: frames.cancel, capacity: 3 });
    sampler.start();
    for (let t = 0; t <= 16 * 10; t += 16) frames.tick(t);
    expect(sampler.summary().frames).toBe(3);
  });
});
