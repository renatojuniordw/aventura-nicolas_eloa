import { describe, it, expect } from 'vitest';
import { JumpDetector, magnitudeInG, DEFAULT_JUMP_DETECTOR_THRESHOLDS } from './jump-detector.js';

/** A steady sample at `g` magnitude, all on the z axis for simplicity. */
function sampleAt(g) {
  return { x: 0, y: 0, z: g * 9.81 };
}

/**
 * Builds a fixture: `restMs` of steady 1g, then a freefall dip to ~0.2g for
 * `freefallMs`, then an impact spike to ~2g, then back to rest — a
 * synthetic stand-in for a recorded real jump (docs/12 §10 asks for exactly
 * this: feed a fixture, not real `devicemotion`).
 */
function jumpFixture({ freefallMs = 200, stepMs = 10 } = {}) {
  const samples = [];
  let t = 0;
  for (; t < 100; t += stepMs) samples.push({ t, sample: sampleAt(1) });
  for (let ft = 0; ft < freefallMs; ft += stepMs) samples.push({ t: t + ft, sample: sampleAt(0.2) });
  t += freefallMs;
  samples.push({ t, sample: sampleAt(2.2) });
  t += stepMs;
  for (let rt = 0; rt < 200; rt += stepMs) samples.push({ t: t + rt, sample: sampleAt(1) });
  return samples;
}

function feedAll(detector, fixture) {
  return fixture.map(({ sample, t }) => detector.feed(sample, t));
}

describe('magnitudeInG', () => {
  it('reads 1g at rest regardless of axis orientation', () => {
    expect(magnitudeInG({ x: 9.81, y: 0, z: 0 })).toBeCloseTo(1, 5);
    expect(magnitudeInG({ x: 0, y: 0, z: 9.81 })).toBeCloseTo(1, 5);
  });
});

describe('JumpDetector', () => {
  it('detects exactly one jump for a real jump fixture', () => {
    const detector = new JumpDetector();
    const results = feedAll(detector, jumpFixture());
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('does not fire on steady rest — no false positives sitting still', () => {
    const detector = new JumpDetector();
    let t = 0;
    let fired = false;
    for (; t < 2000; t += 10) {
      if (detector.feed(sampleAt(1), t)) fired = true;
    }
    expect(fired).toBe(false);
  });

  it('ignores a freefall dip that is too short to be a real jump (noise)', () => {
    const detector = new JumpDetector();
    const results = feedAll(detector, jumpFixture({ freefallMs: DEFAULT_JUMP_DETECTOR_THRESHOLDS.minFreefallMs / 2 }));
    expect(results.filter(Boolean)).toHaveLength(0);
  });

  it('aborts a freefall that never lands within maxFreefallMs (no impact ever comes)', () => {
    const detector = new JumpDetector();
    let t = 0;
    for (; t < 100; t += 10) detector.feed(sampleAt(1), t);
    // Stuck at low-g for way longer than a jump ever takes, with no impact
    // spike anywhere in the signal — must never fire.
    let fired = false;
    for (let ft = 0; ft < DEFAULT_JUMP_DETECTOR_THRESHOLDS.maxFreefallMs + 500; ft += 10) {
      if (detector.feed(sampleAt(0.2), t + ft)) fired = true;
    }
    expect(fired).toBe(false);
  });

  it('applies a cooldown so a bouncing landing does not double-fire', () => {
    const detector = new JumpDetector();
    const fixture = jumpFixture();
    // Feed only up through the impact sample, not the full fixture's fixed
    // 200ms rest tail — that padding would by itself eat most of a short
    // cooldown, making this test unable to express "still within cooldown"
    // regardless of how minFreefallMs and cooldownMs are tuned.
    const impactIndex = fixture.findIndex(({ sample }) => sample.z > 9.81 * 2);
    const lastT = fixture[impactIndex].t;
    feedAll(detector, fixture.slice(0, impactIndex + 1));

    // A second freefall+impact right after, inside the cooldown window.
    let t = lastT + 5;
    detector.feed(sampleAt(0.2), t);
    t += DEFAULT_JUMP_DETECTOR_THRESHOLDS.minFreefallMs + 20;
    const secondJump = detector.feed(sampleAt(2.2), t);

    expect(secondJump).toBe(false);
  });

  it('allows a second real jump once the cooldown has elapsed', () => {
    const detector = new JumpDetector();
    const first = jumpFixture();
    feedAll(detector, first);
    const lastT = first[first.length - 1].t;

    const second = jumpFixture().map(({ sample, t }) => ({
      sample,
      t: t + lastT + DEFAULT_JUMP_DETECTOR_THRESHOLDS.cooldownMs + 50,
    }));
    const results = feedAll(detector, second);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('adapts thresholds to a calibrated resting magnitude instead of a fixed 1g', () => {
    const detector = new JumpDetector();
    // Phone strapped at an angle: "rest" reads 1.3g, not 1g.
    detector.calibrate([sampleAt(1.3), sampleAt(1.3), sampleAt(1.3)]);

    expect(detector.freefallThreshold).toBeCloseTo(1.3 - DEFAULT_JUMP_DETECTOR_THRESHOLDS.freefallDeltaG, 5);
    expect(detector.impactThreshold).toBeCloseTo(1.3 + DEFAULT_JUMP_DETECTOR_THRESHOLDS.impactDeltaG, 5);
  });

  it('accepts custom thresholds for live tuning (debug panel use case)', () => {
    const detector = new JumpDetector({
      freefallDeltaG: 0.1,
      impactDeltaG: 0.1,
      minFreefallMs: 0,
      maxFreefallMs: 100000,
      cooldownMs: 0,
    });
    // A much smaller dip now counts as freefall.
    detector.feed(sampleAt(1), 0);
    detector.feed(sampleAt(0.85), 10);
    const jumped = detector.feed(sampleAt(1.2), 20);
    expect(jumped).toBe(true);
  });
});
