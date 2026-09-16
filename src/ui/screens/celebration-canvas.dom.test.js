// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { createCelebrationCanvas } from './celebration-canvas.js';

/**
 * DOM path of the celebration canvas: it must build a sized canvas when a 2D
 * context is available. When the context is unavailable (this is the case in
 * jsdom without a canvas backend) it must still hand back the element and a
 * safe stop, and must NOT start a requestAnimationFrame loop.
 */

beforeAll(() => {
  // jsdom does not implement a real 2D context; force the "no context" branch
  // so the animation loop is never started inside a unit test.
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe('createCelebrationCanvas (DOM)', () => {
  it('returns a sized canvas element with a safe stop when no 2D context exists', () => {
    const { canvas, stop } = createCelebrationCanvas('/assets/celebrate.png', 120, 120);

    expect(canvas).not.toBeNull();
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(120);
    expect(canvas.className).toBe('hero-celebrate-canvas');
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });

  it('respects custom dimensions', () => {
    const { canvas } = createCelebrationCanvas('/assets/celebrate.png', 64, 48);

    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(48);
  });
});