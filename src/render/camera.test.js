import { describe, it, expect } from 'vitest';
import { Camera } from './camera.js';

const viewport = { width: 960, height: 540 };

describe('Camera', () => {
  it('translates world coordinates by the camera offset', () => {
    const camera = new Camera({ viewport, maxX: 960 });
    camera.x = 100;
    expect(camera.worldToScreen(150, 50)).toEqual({ x: 50, y: 50 });
  });

  it('never scrolls before the level start', () => {
    const camera = new Camera({ viewport, maxX: 960, startX: 0 });
    camera.follow({ x: 0, w: 30 });
    expect(camera.x).toBe(0);
  });

  it('clamps the scroll to the level end', () => {
    const camera = new Camera({ viewport, maxX: 960 });
    for (let i = 0; i < 500; i += 1) {
      camera.follow({ x: 3000, w: 30 });
    }
    expect(camera.x).toBe(960);
  });

  it('eases toward the target instead of snapping', () => {
    const camera = new Camera({ viewport, maxX: 5000, smoothing: 0.5 });
    camera.follow({ x: 1000, w: 30 });
    const firstStep = camera.x;
    expect(firstStep).toBeGreaterThan(0);
    camera.follow({ x: 1000, w: 30 });
    expect(camera.x).toBeGreaterThan(firstStep);
  });

  it('snapTo jumps directly to the resting position', () => {
    const camera = new Camera({ viewport, maxX: 5000, smoothing: 0.1 });
    camera.snapTo({ x: 1000, w: 30 });
    expect(camera.x).toBeGreaterThan(0);
    const before = camera.x;
    camera.snapTo({ x: 1000, w: 30 });
    expect(camera.x).toBeCloseTo(before);
  });

  it('reports zero maxX for worlds narrower than the viewport', () => {
    const camera = new Camera({ viewport, maxX: -50 });
    expect(camera.maxX).toBe(0);
    camera.follow({ x: 500, w: 30 });
    expect(camera.x).toBe(0);
  });

  it('never scrolls left of minX (the wall of an endless world)', () => {
    const camera = new Camera({ viewport, minX: 4000, maxX: Number.POSITIVE_INFINITY });
    camera.snapTo({ x: 3900, w: 30 });
    expect(camera.x).toBe(4000);
    camera.minX = 5000;
    camera.follow({ x: 4000, w: 30 });
    expect(camera.x).toBe(5000);
  });
});

