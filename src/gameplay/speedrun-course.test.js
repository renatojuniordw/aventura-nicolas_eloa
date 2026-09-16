import { describe, it, expect } from 'vitest';
import {
  buildSpeedrunCourse,
  isSafeFromHazards,
  MIN_HAZARD_DISTANCE,
} from './speedrun-course.js';

describe('SpeedrunCourse', () => {
  it('builds a continuous 26-segment course from A to Z', () => {
    const course = buildSpeedrunCourse();
    expect(course.id).toBe('speedrun-maratona-alfabeto');
    expect(course.worldWidth).toBe(26 * 1920);
    expect(course.checkpoints).toHaveLength(26);
    expect(course.checkpoints[0]).toEqual({ x: 96, y: 406 });
    expect(course.checkpoints[1]).toEqual({ x: 1920 + 96, y: 406 });

    // 26 targets in order A to Z
    const targets = course.items.filter((item) => item.type === 'target');
    expect(targets).toHaveLength(26);
    expect(targets.map((t) => t.label).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

    // 3 distractors per segment = 78 distractors
    const distractors = course.items.filter((item) => item.type === 'distractor');
    expect(distractors).toHaveLength(78);
  });

  it('randomizes item positions between runs', () => {
    const run1 = buildSpeedrunCourse({ random: () => 0.1 });
    const run2 = buildSpeedrunCourse({ random: () => 0.8 });

    const target1 = run1.items.find((item) => item.segmentIndex === 0 && item.type === 'target');
    const target2 = run2.items.find((item) => item.segmentIndex === 0 && item.type === 'target');

    // Positions should differ based on random generator
    expect(target1.x !== target2.x || target1.y !== target2.y).toBe(true);
  });

  it('places all items high enough so that a walking player cannot reach them without jumping', () => {
    const course = buildSpeedrunCourse();
    // Ground surface is at y = 448; player on ground has head at y = 406.
    // Every item bottom (item.y + item.h) must be strictly above y = 406.
    for (const item of course.items) {
      expect(item.y + item.h).toBeLessThan(406);
    }
  });

  it('correctly evaluates isSafeFromHazards', () => {
    const hazards = [{ x: 1000, w: 64, y: 400, h: 32 }];

    // Directly over hazard
    expect(isSafeFromHazards(1010, 32, hazards, 160)).toBe(false);

    // Within safety margin to the left
    expect(isSafeFromHazards(1000 - 32 - 50, 32, hazards, 160)).toBe(false);

    // Within safety margin to the right
    expect(isSafeFromHazards(1064 + 50, 32, hazards, 160)).toBe(false);

    // Safe distance away to the left
    expect(isSafeFromHazards(1000 - 32 - 170, 32, hazards, 160)).toBe(true);

    // Safe distance away to the right
    expect(isSafeFromHazards(1064 + 170, 32, hazards, 160)).toBe(true);
  });

  it('never places any letter directly over or dangerously close to any hazard across all segments', () => {
    // Test across several random seeds to ensure jitter and random selection always respect the buffer
    const seeds = [0.05, 0.25, 0.5, 0.75, 0.95];

    for (const seed of seeds) {
      const course = buildSpeedrunCourse({ random: () => seed });

      for (const item of course.items) {
        const itemLeft = item.x;
        const itemRight = item.x + item.w;

        for (const hazard of course.hazards) {
          const hazardLeft = hazard.x;
          const hazardRight = hazard.x + hazard.w;

          // Check for direct horizontal overlap
          const overlaps = itemRight > hazardLeft && itemLeft < hazardRight;
          expect(overlaps).toBe(false);

          // Check distance margin
          let distance = 0;
          if (itemRight <= hazardLeft) {
            distance = hazardLeft - itemRight;
          } else if (itemLeft >= hazardRight) {
            distance = itemLeft - hazardRight;
          }
          expect(distance).toBeGreaterThanOrEqual(MIN_HAZARD_DISTANCE);
        }
      }
    }
  });
});

