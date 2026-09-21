import { describe, it, expect } from 'vitest';
import {
  CHECKPOINT_BOUNDS,
  FINISH_PORTAL_BOUNDS,
  LETTER_CARRIER_BOUNDS,
  FINISH_PORTAL_SIZE,
  finishPortalPosition,
  resolveBackgroundKey,
} from './sprite-assets.js';

/**
 * Covers the asset-mapping module extracted from `sprites.js` (FASE 3), so the
 * background key resolution branches are pinned independently of the renderer.
 */
describe('resolveBackgroundKey', () => {
  it('falls back to the default panorama when no level is given', () => {
    expect(resolveBackgroundKey(null)).toBe('bg:primavera-lago');
    expect(resolveBackgroundKey(undefined)).toBe('bg:primavera-lago');
  });

  it('honours an explicit bg: key verbatim', () => {
    expect(resolveBackgroundKey({ background: 'bg:outono-vale' })).toBe('bg:outono-vale');
  });

  it('maps filename hints to themed panoramas', () => {
    expect(resolveBackgroundKey({ background: 'cenario-pomar.png' })).toBe('bg:primavera-pomar');
    expect(resolveBackgroundKey({ background: 'fundo-bosque.png' })).toBe('bg:outono-bosque');
    expect(resolveBackgroundKey({ background: 'fundo-vale.png' })).toBe('bg:outono-vale');
    expect(resolveBackgroundKey({ background: 'tiles/garden.png' })).toBe('bg:garden-pixel');
  });

  it('falls back to the level category when the background is not a usable string', () => {
    expect(resolveBackgroundKey({ id: 'fase-palavras-1', background: { bad: true } })).toBe(
      'bg:outono-bosque',
    );
    expect(resolveBackgroundKey({ id: 'fase-dificil-2' })).toBe('bg:outono-bosque');
    expect(resolveBackgroundKey({ id: 'fase-silabas-3' })).toBe('bg:primavera-pomar');
    expect(resolveBackgroundKey({ id: 'fase-encontros-4' })).toBe('bg:outono-vale');
    expect(resolveBackgroundKey({ id: 'fase-alfabeto-a' })).toBe('bg:primavera-lago');
  });

  it('uses the category fallback when background is a non-matching string', () => {
    expect(resolveBackgroundKey({ id: 'fase-silabas-x', background: 'qualquer.png' })).toBe(
      'bg:primavera-pomar',
    );
  });
});

describe('asset bounds', () => {
  it('are frozen constants with exactly known crop rectangles for each trimmed asset', () => {
    // LETTER_CARRIER_BOUNDS
    expect(Object.isFrozen(LETTER_CARRIER_BOUNDS)).toBe(true);
    expect(LETTER_CARRIER_BOUNDS.sx).toBe(103);
    expect(LETTER_CARRIER_BOUNDS.sy).toBe(112);
    expect(LETTER_CARRIER_BOUNDS.sw).toBe(298);
    expect(LETTER_CARRIER_BOUNDS.sh).toBe(289);

    // CHECKPOINT_BOUNDS
    expect(Object.isFrozen(CHECKPOINT_BOUNDS)).toBe(true);
    expect(CHECKPOINT_BOUNDS.sx).toBe(134);
    expect(CHECKPOINT_BOUNDS.sy).toBe(46);
    expect(CHECKPOINT_BOUNDS.sw).toBe(256);
    expect(CHECKPOINT_BOUNDS.sh).toBe(426);

    // FINISH_PORTAL_BOUNDS
    expect(Object.isFrozen(FINISH_PORTAL_BOUNDS)).toBe(true);
    expect(FINISH_PORTAL_BOUNDS.sx).toBe(70);
    expect(FINISH_PORTAL_BOUNDS.sy).toBe(23);
    expect(FINISH_PORTAL_BOUNDS.sw).toBe(363);
    expect(FINISH_PORTAL_BOUNDS.sh).toBe(457);

    // All dimensions must be positive (every crop rectangle has non-zero area)
    for (const bounds of [LETTER_CARRIER_BOUNDS, CHECKPOINT_BOUNDS, FINISH_PORTAL_BOUNDS]) {
      expect(bounds.sw).toBeGreaterThan(0);
      expect(bounds.sh).toBeGreaterThan(0);
      expect(bounds.sx).toBeGreaterThanOrEqual(0);
      expect(bounds.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it('exposes separate frozen constants per asset (not interchangeable)', () => {
    // Each constant has a distinct origin point, so swapping them would fail
    expect(LETTER_CARRIER_BOUNDS.sx).not.toBe(CHECKPOINT_BOUNDS.sx);
    expect(FINISH_PORTAL_BOUNDS.sx).not.toBe(LETTER_CARRIER_BOUNDS.sx);
  });
});
describe('finishPortalPosition', () => {
  it('stands on the ground near the right edge by default', () => {
    expect(finishPortalPosition({ worldWidth: 1920, worldHeight: 540 })).toEqual({
      x: 1790,
      y: 540 - 92 - FINISH_PORTAL_SIZE.h,
    });
  });

  it('falls back to a default world size when the level has none', () => {
    expect(finishPortalPosition({})).toEqual(finishPortalPosition({ worldWidth: 1920, worldHeight: 540 }));
  });

  it('honours an explicit position from the level file', () => {
    expect(finishPortalPosition({ finish: { x: 300, y: 200 }, worldWidth: 1920 })).toEqual({ x: 300, y: 200 });
  });
});
