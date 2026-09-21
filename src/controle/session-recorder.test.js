import { describe, expect, it } from 'vitest';
import { SessionRecorder } from './session-recorder.ts';

describe('SessionRecorder', () => {
  it('records acceleration only when no rotation is given', () => {
    const recorder = new SessionRecorder();
    recorder.push({ x: 0, y: 0, z: 9.81 }, 10);
    const { samples } = JSON.parse(recorder.toJSON());
    expect(samples).toEqual([{ t: 10, x: 0, y: 0, z: 9.81 }]);
  });

  it('records rotationRate as rx/ry/rz when fully reported', () => {
    const recorder = new SessionRecorder();
    recorder.push({ x: 0, y: 0, z: 9.81 }, 10, { alpha: 1, beta: 2, gamma: 3 });
    const { samples } = JSON.parse(recorder.toJSON());
    expect(samples[0]).toMatchObject({ rx: 1, ry: 2, rz: 3 });
  });

  it('omits rotation when any axis is null', () => {
    const recorder = new SessionRecorder();
    recorder.push({ x: 0, y: 0, z: 9.81 }, 10, { alpha: 1, beta: null, gamma: 3 });
    const { samples } = JSON.parse(recorder.toJSON());
    expect(samples[0]).not.toHaveProperty('rx');
  });
});

describe('SessionRecorder markers, detections and sampling', () => {
  it('serialises markers and detections next to the samples', () => {
    const recorder = new SessionRecorder();
    recorder.mark('jump', 500);
    recorder.logDetection(520, { freefallMs: 200, minFreefallG: 0.2, impactG: 2 });
    const json = JSON.parse(recorder.toJSON());
    expect(json.markers).toEqual([{ t: 500, kind: 'jump' }]);
    expect(json.detections).toEqual([{ t: 520, freefallMs: 200, minFreefallG: 0.2, impactG: 2 }]);
    expect(recorder.markerCount).toBe(1);
  });

  it('reports sampling rate, largest gap and delivery lag', () => {
    const recorder = new SessionRecorder();
    for (let i = 0; i < 5; i += 1) recorder.push({ x: 0, y: 0, z: 9.81 }, i * 20, null, i === 3 ? 12 : 1);
    recorder.push({ x: 0, y: 0, z: 9.81 }, 200, null, 1);
    const stats = recorder.samplingStats();
    expect(stats.medianDtMs).toBe(20);
    expect(stats.effectiveHz).toBe(50);
    expect(stats.maxGapMs).toBe(120);
    expect(stats.maxLagMs).toBe(12);
  });

  it('has no sampling stats with fewer than two samples', () => {
    expect(new SessionRecorder().samplingStats()).toBeNull();
  });
});
