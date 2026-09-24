import { describe, it, expect } from 'vitest';
import { isSafeFromHazards } from './speedrun-course.js';

describe('speedrun course helpers', () => {
  it('reports safe and unsafe positions relative to hazards', () => {
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
});
