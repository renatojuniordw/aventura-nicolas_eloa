// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { createCelebrationCanvas } from './celebration-canvas.js';

/**
 * DOM path of the celebration canvas: it must build a sized canvas when a 2D
 * context is available. When the context is unavailable (this is the case in
 * jsdom without a canvas backend) it must still hand back the element and a
 * safe stop, and must NOT start a requestAnimationFrame loop.
 *
 * When a real 2D context IS available, it MUST start the animation loop and
 * set `stop` up to cancel it.
 */

let rAFSpy;
let cAFSpy;
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalImage = globalThis.Image;

/** jsdom ships no 2D context backend, so this file's baseline is "no context". */
const noContextStub = () => null;

beforeEach(() => {
  rAFSpy = vi.fn(() => 42);
  cAFSpy = vi.fn();
  globalThis.requestAnimationFrame = rAFSpy;
  globalThis.cancelAnimationFrame = cAFSpy;
  // Re-asserted before *every* test: a test that installs a working context or
  // a stubbed Image must not leak into its siblings, otherwise the file only
  // passes in declaration order (fails under --sequence.shuffle).
  HTMLCanvasElement.prototype.getContext = noContextStub;
  globalThis.Image = originalImage;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
  globalThis.Image = originalImage;
});

beforeAll(() => {
  // Force the "no context" branch by default so the animation loop is never
  // started inside a unit test unless the test opts in explicitly.
  HTMLCanvasElement.prototype.getContext = noContextStub;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('createCelebrationCanvas (DOM)', () => {
  it('returns a sized canvas element with a safe stop when no 2D context exists', () => {
    const { canvas, stop } = createCelebrationCanvas('/assets/celebrate.webp', 120, 120);

    expect(canvas).not.toBeNull();
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(120);
    expect(canvas.className).toBe('hero-celebrate-canvas');
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    // No context → no rAF loop started
    expect(rAFSpy).not.toHaveBeenCalled();
    expect(cAFSpy).not.toHaveBeenCalled();
  });

  it('respects custom dimensions', () => {
    const { canvas } = createCelebrationCanvas('/assets/celebrate.webp', 64, 48);

    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(48);
  });

  it('starts an rAF animation loop when a 2D context is available, and stop cancels it', () => {
    // Install a working getContext for this test only (reset in beforeEach).
    HTMLCanvasElement.prototype.getContext = () => ({ clearRect: vi.fn(), drawImage: vi.fn() });

    const { canvas, stop } = createCelebrationCanvas('/assets/celebrate.webp', 120, 120);

    expect(rAFSpy).toHaveBeenCalledTimes(1);
    expect(rAFSpy).toHaveBeenCalledWith(expect.any(Function));
    expect(rAFSpy.mock.results[0].value).toBe(42);

    // Calling stop cancels the rAF
    stop();
    expect(cAFSpy).toHaveBeenCalledWith(42);
  });

  it('advances through the 2x2 frame grid as time passes', () => {
    const drawImage = vi.fn();
    const clearRect = vi.fn();
    HTMLCanvasElement.prototype.getContext = () => ({ clearRect, drawImage });
    // 240x240 sheet → each of the four frames is a 120x120 quadrant.
    globalThis.Image = class {
      constructor() {
        this.complete = true;
        this.naturalWidth = 240;
        this.naturalHeight = 240;
      }
    };

    createCelebrationCanvas('/assets/celebrate.webp', 120, 120);
    const step = rAFSpy.mock.calls[0][0];

    // Each tick is >= frameDuration (180ms), so the frame advances every time.
    step(1000);
    step(1180);
    step(1360);
    step(1540);

    expect(drawImage).toHaveBeenCalledTimes(4);
    expect(clearRect).toHaveBeenCalledTimes(4);
    // (col, row) walks the 2x2 grid: 1,0 → 0,1 → 1,1 → back to 0,0.
    const crops = drawImage.mock.calls.map(([, sx, sy, sw, sh]) => [sx, sy, sw, sh]);
    expect(crops).toEqual([
      [120, 0, 120, 120],
      [0, 120, 120, 120],
      [120, 120, 120, 120],
      [0, 0, 120, 120],
    ]);
  });
});