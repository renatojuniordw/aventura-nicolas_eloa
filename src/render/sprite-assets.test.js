import { describe, it, expect } from 'vitest';
import {
  CHECKPOINT_BOUNDS,
  FINISH_PORTAL_BOUNDS,
  LETTER_CARRIER_BOUNDS,
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
  it('are frozen constants with the expected crop shape', () => {
    for (const bounds of [LETTER_CARRIER_BOUNDS, CHECKPOINT_BOUNDS, FINISH_PORTAL_BOUNDS]) {
      expect(Object.isFrozen(bounds)).toBe(true);
      expect(bounds).toEqual({
        sx: expect.any(Number),
        sy: expect.any(Number),
        sw: expect.any(Number),
        sh: expect.any(Number),
      });
    }
  });
});