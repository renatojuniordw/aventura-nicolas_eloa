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
