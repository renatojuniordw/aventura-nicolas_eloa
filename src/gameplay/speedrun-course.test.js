import { describe, it, expect } from 'vitest';
import { buildSpeedrunCourse } from './speedrun-course.js';

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
});
