import { describe, it, expect, vi } from 'vitest';
import { SpriteRenderer } from './sprites.js';
import { COLORS } from '../core/config.js';

function createMockRenderer() {
  return {
    width: 960,
    height: 540,
    clear: vi.fn(),
    screenImage: vi.fn(),
    worldImage: vi.fn(),
    worldFillRect: vi.fn(),
    worldText: vi.fn(),
  };
}

describe('SpriteRenderer', () => {
  it('falls back to renderer.clear with default sky color when no background asset is present', () => {
    const sprites = new SpriteRenderer();
    const renderer = createMockRenderer();

    sprites.drawBackground(renderer, 100);

    expect(renderer.clear).toHaveBeenCalledWith(COLORS.sky);
    expect(renderer.screenImage).not.toHaveBeenCalled();
  });

  it('draws panoramic parallax background with screenImage when background asset exists', () => {
    const mockAssets = new Map([
      ['bg:primavera-lago', { width: 2172, height: 724 }],
    ]);
    const sprites = new SpriteRenderer({ assets: mockAssets });
    sprites.setLevel({ id: 'fase-alfabeto-a', background: 'bg:primavera-lago' });
    const renderer = createMockRenderer();

    sprites.drawBackground(renderer, 200);

    expect(renderer.screenImage).toHaveBeenCalled();
    expect(renderer.clear).not.toHaveBeenCalled();
  });

  it('draws letter-carrier token and centered text when item asset is available', () => {
    const mockAssets = new Map([
      ['item:letter-carrier', { width: 1254, height: 1254 }],
    ]);
    const sprites = new SpriteRenderer({ assets: mockAssets });
    const renderer = createMockRenderer();

    const items = [
      { id: 'item-1', type: 'target', label: 'A', x: 200, y: 300, w: 32, h: 32 },
    ];

    sprites.drawItems(renderer, items);

    expect(renderer.worldImage).toHaveBeenCalled();
    expect(renderer.worldText).toHaveBeenCalledWith(
      'A',
      216,
      expect.any(Number),
      expect.objectContaining({ color: '#142420' }),
    );
  });

  it('draws checkpoint flags and finish portal in drawObjects', () => {
    const mockAssets = new Map([
      ['object:checkpoint', { width: 1254, height: 1254 }],
      ['object:finish-portal', { width: 1254, height: 1254 }],
    ]);
    const sprites = new SpriteRenderer({ assets: mockAssets });
    const renderer = createMockRenderer();

    const level = {
      worldWidth: 1920,
      worldHeight: 540,
      checkpoint: { x: 150, y: 400 },
    };

    sprites.drawObjects(renderer, level);

    // One for checkpoint, one for finish portal
    expect(renderer.worldImage).toHaveBeenCalledTimes(2);
  });
});
