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
    measureText: vi.fn((text) => text.length * 14),
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
      expect.objectContaining({ color: '#1a1a1a' }),
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

  it('hides the portal until a streamed world opens it', () => {
    const mockAssets = new Map([
      ['object:checkpoint', { width: 1254, height: 1254 }],
      ['object:finish-portal', { width: 1254, height: 1254 }],
    ]);
    const sprites = new SpriteRenderer({ assets: mockAssets });
    const renderer = createMockRenderer();
    const level = { worldWidth: 1920, worldHeight: 540, checkpoint: { x: 150, y: 400 }, portalActive: false };

    sprites.drawObjects(renderer, level);

    // Only the checkpoint flag.
    expect(renderer.worldImage).toHaveBeenCalledTimes(1);
  });

  it('grows the portal from the ground as it is revealed, at its full size once done', () => {
    const mockAssets = new Map([['object:finish-portal', { width: 1254, height: 1254 }]]);
    const sprites = new SpriteRenderer({ assets: mockAssets });
    const level = {
      worldWidth: 1920,
      worldHeight: 540,
      finish: { x: 1000, y: 364 },
      portalActive: true,
    };
    const portalCall = (reveal) => {
      const renderer = createMockRenderer();
      sprites.drawObjects(renderer, { ...level, portalReveal: reveal });
      return renderer.worldImage.mock.calls.at(-1);
    };

    const start = portalCall(0.2);
    const done = portalCall(1);
    // args: image, sx, sy, sw, sh, dx, dy, dw, dh
    expect(done[7]).toBe(130);
    expect(done[8]).toBe(126);
    expect(start[7]).toBeLessThan(done[7]);
    // The bottom edge stays on the ground while it grows.
    expect(start[6] + start[8]).toBeCloseTo(done[6] + done[8]);
  });
});

it.each([null, new Map([['item:letter-carrier', {}]])])('fits full word labels with or without assets (%s)', (assets) => {
  const renderer = createMockRenderer();
  const sprites = new SpriteRenderer({ assets, reducedMotion: () => true });
  const item = { id: 'word', label: 'BOLA', type: 'target', x: 200, y: 300, w: 32, h: 32 };
  sprites.drawItems(renderer, [item]);
  const panel = renderer.worldFillRect.mock.calls.find((call) => call[4] === '#fbf4df');
  expect(panel[2]).toBeGreaterThanOrEqual(renderer.measureText('BOLA') + 18);
  expect(renderer.worldText).toHaveBeenCalledWith('BOLA', 216, 316, expect.any(Object));
  expect(item).toEqual({ id: 'word', label: 'BOLA', type: 'target', x: 200, y: 300, w: 32, h: 32 });
});
