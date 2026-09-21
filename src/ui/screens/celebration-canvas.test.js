import { describe, it, expect } from 'vitest';
import { createCelebrationCanvas } from './celebration-canvas.js';

/**
 * The module extracted from `main-menu.js` (FASE 3) must be safe to import in a
 * non-DOM environment (SSR/tests), where it returns a null canvas and a no-op
 * stop. The DOM path is covered in `celebration-canvas.dom.test.js`.
 */
describe('createCelebrationCanvas (no DOM)', () => {
  it('returns a null canvas and a safe no-op stop when document is absent', () => {
    const result = createCelebrationCanvas('/assets/characters/x/celebrate.webp');

    expect(result.canvas).toBeNull();
    expect(typeof result.stop).toBe('function');
    expect(() => result.stop()).not.toThrow();
  });
});