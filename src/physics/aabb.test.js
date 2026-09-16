import { describe, it, expect } from 'vitest';
import { createBox, overlap, containsPoint, centerOf, boundsOf } from './aabb.js';

describe('aabb', () => {
  it('detects overlapping boxes', () => {
    const a = createBox(0, 0, 10, 10);
    const b = createBox(5, 5, 10, 10);
    expect(overlap(a, b)).toBe(true);
  });

  it('does not treat touching edges as an overlap', () => {
    const a = createBox(0, 0, 10, 10);
    const b = createBox(10, 0, 10, 10);
    expect(overlap(a, b)).toBe(false);
  });

  it('detects separation on a single axis', () => {
    const a = createBox(0, 0, 10, 10);
    expect(overlap(a, createBox(0, 20, 10, 10))).toBe(false);
    expect(overlap(a, createBox(20, 0, 10, 10))).toBe(false);
  });

  it('containsPoint respects the box bounds', () => {
    const box = createBox(10, 10, 20, 20);
    expect(containsPoint(box, 15, 15)).toBe(true);
    expect(containsPoint(box, 30, 30)).toBe(true);
    expect(containsPoint(box, 9, 15)).toBe(false);
  });

  it('computes the center', () => {
    expect(centerOf(createBox(0, 0, 10, 20))).toEqual({ x: 5, y: 10 });
  });

  it('computes the bounding box of several boxes', () => {
    const bounds = boundsOf([createBox(0, 0, 10, 10), createBox(40, 20, 10, 10)]);
    expect(bounds).toEqual({ x: 0, y: 0, w: 50, h: 30 });
  });
});
