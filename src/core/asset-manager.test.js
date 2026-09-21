import { describe, it, expect, vi } from 'vitest';
import { AssetManager } from './asset-manager.js';

describe('AssetManager', () => {
  it('loads and caches images by name', async () => {
    const assets = new AssetManager((src) => Promise.resolve({ src }));
    await assets.load({ a: '/a.png' });
    expect(assets.has('a')).toBe(true);
    expect(assets.get('a')).toEqual({ src: '/a.png' });
    expect(assets.has('b')).toBe(false);
  });

  it('does not reload names that are already cached', async () => {
    const loader = vi.fn((src) => Promise.resolve({ src }));
    const assets = new AssetManager(loader);
    await assets.load({ a: '/a.png' });
    await assets.load({ a: '/a.png', b: '/b.png' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares one request between overlapping loads of the same name', async () => {
    let resolve;
    const loader = vi.fn(() => new Promise((r) => { resolve = r; }));
    const assets = new AssetManager(loader);
    const first = assets.load({ a: '/a.png' });
    const second = assets.load({ a: '/a.png' });
    resolve({ ok: true });
    await Promise.all([first, second]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries a name after a failed load', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true });
    const assets = new AssetManager(loader);
    await expect(assets.load({ a: '/a.png' })).rejects.toThrow('network');
    await assets.load({ a: '/a.png' });
    expect(assets.has('a')).toBe(true);
  });
});
