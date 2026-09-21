import { describe, it, expect } from 'vitest';
import { replaySession, scoreDetections, sweepThresholds, thresholdGrid } from './session-replay.js';
import { DEFAULT_JUMP_DETECTOR_THRESHOLDS } from './jump-detector.js';

const at = (g, t, rot) => ({ t, x: 0, y: 0, z: g * 9.81, ...(rot ? { rx: rot, ry: 0, rz: 0 } : {}) });

/** 1.5s calibration at rest, then one jump whose landing sample is at t=2300. */
function recording({ rotation } = {}) {
  const samples = [];
  for (let t = 0; t < 1500; t += 20) samples.push(at(1, t));
  for (let t = 1500; t < 2000; t += 20) samples.push(at(1, t));
  for (let t = 2000; t < 2200; t += 20) samples.push(at(0.2, t, rotation));
  samples.push(at(2.2, 2200, rotation));
  for (let t = 2220; t < 3000; t += 20) samples.push(at(1, t));
  return { samples, markers: [{ t: 2400, kind: 'jump' }], calibrationEndT: 1500 };
}

describe('replaySession', () => {
  it('finds the jump and reports its freefall shape', () => {
    const [detection] = replaySession(recording());
    expect(detection.t).toBe(2200);
    expect(detection.info.freefallMs).toBe(200);
    expect(detection.info.minFreefallG).toBeCloseTo(0.2, 5);
    expect(detection.info.impactG).toBeCloseTo(2.2, 5);
  });

  it('reports the peak rotation around the jump, or null without gyro data', () => {
    expect(replaySession(recording({ rotation: 300 }))[0].rotationPeak).toBe(300);
    expect(replaySession(recording())[0].rotationPeak).toBeNull();
  });

  it('falls back to a 1.5s calibration window without calibrationEndT', () => {
    const rec = recording();
    delete rec.calibrationEndT;
    expect(replaySession(rec)).toHaveLength(1);
  });

  it('returns nothing for an empty recording', () => {
    expect(replaySession({ samples: [] })).toEqual([]);
  });
});

describe('scoreDetections', () => {
  const detection = (t) => ({ t, info: { freefallMs: 200, minFreefallG: 0.2, impactG: 2 }, rotationPeak: null });

  it('counts hits, false positives and misses', () => {
    const score = scoreDetections([detection(1000), detection(5000)], [
      { t: 1200, kind: 'jump' },
      { t: 9000, kind: 'jump' },
    ]);
    expect(score).toMatchObject({ hits: 1, falsePositives: 1, misses: 1 });
    expect(score.matched).toEqual([true, false]);
    expect(score.f1).toBeCloseTo(0.5, 5);
  });

  it('matches each marker to at most one detection', () => {
    const score = scoreDetections([detection(1000), detection(1100)], [{ t: 1050, kind: 'jump' }]);
    expect(score).toMatchObject({ hits: 1, falsePositives: 1, misses: 0 });
  });

  it('ignores markers of other kinds', () => {
    expect(scoreDetections([detection(1000)], [{ t: 1000, kind: 'note' }]).falsePositives).toBe(1);
  });
});

describe('thresholdGrid / sweepThresholds', () => {
  it('builds the cartesian product and drops dead min>=max configs', () => {
    const grid = thresholdGrid({ freefallDeltaG: [0.3, 0.4], minFreefallMs: [100, 800] });
    expect(grid).toHaveLength(2); // 800 >= default maxFreefallMs 750 is dropped
    expect(grid.every((c) => c.minFreefallMs === 100)).toBe(true);
  });

  it('ranks a config that catches the jump above one that misses it', () => {
    const grid = thresholdGrid({ impactDeltaG: [0.7, 1.6] }); // 1.6g over rest: impact 2.2g is not > 2.6g
    const results = sweepThresholds(recording(), grid);
    expect(results[0].thresholds.impactDeltaG).toBe(0.7);
    expect(results[0].score.hits).toBe(1);
    expect(results[1].score.misses).toBe(1);
    expect(DEFAULT_JUMP_DETECTOR_THRESHOLDS.impactDeltaG).toBe(0.7);
  });
});
