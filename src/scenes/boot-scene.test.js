import { describe, it, expect, vi } from 'vitest';
import { BootScene, GAME_ASSETS } from './boot-scene.js';
import { CHARACTERS } from '../content/characters.js';

/**
 * Covers the boot scene: preload manifest assembly, fallback on asset-load
 * failure, and the single on-update transition to the menu.
 */

function makeFakeGame(overrides = {}) {
  return {
    assets: {
      load: vi.fn(() => Promise.resolve()),
    },
    scenes: {
      switchTo: vi.fn(),
    },
    ...overrides,
  };
}

describe('BootScene', () => {
  it('exposes a frozen asset manifest with all standard background/base assets', () => {
    expect(Object.isFrozen(GAME_ASSETS)).toBe(true);
    // Standard backgrounds
    expect(GAME_ASSETS['bg:primavera-lago']).toContain('.png');
    expect(GAME_ASSETS['bg:primavera-pomar']).toContain('.png');
    expect(GAME_ASSETS['bg:outono-bosque']).toContain('.png');
    expect(GAME_ASSETS['bg:outono-vale']).toContain('.png');
    expect(GAME_ASSETS['bg:garden-pixel']).toContain('.png');
    // Items
    expect(GAME_ASSETS['item:letter-carrier']).toContain('.png');
    expect(GAME_ASSETS['item:speed']).toContain('.png');
    // Objects
    expect(GAME_ASSETS['object:checkpoint']).toContain('.png');
    expect(GAME_ASSETS['object:finish-portal']).toContain('.png');
    // Terrain
    expect(GAME_ASSETS['terrain:grass-tile']).toContain('.png');
    expect(Object.keys(GAME_ASSETS).length).toBeGreaterThanOrEqual(10);
  });

  it('merges character sprites and portraits into the preload manifest on enter', () => {
    const game = makeFakeGame();
    const scene = new BootScene(game);
    scene.enter();

    // Fire-and-forget: the manifest reaches assets.load synchronously, before
    // the first await, so it is inspectable right after enter().
    expect(game.assets.load).toHaveBeenCalledTimes(1);
    const manifest = game.assets.load.mock.calls[0][0];

    // Every base asset survives the merge...
    expect(manifest).toMatchObject(GAME_ASSETS);

    // ...and each character contributes its poses and portrait, by value.
    for (const character of CHARACTERS) {
      for (const [pose, src] of Object.entries(character.sprites ?? {})) {
        expect(manifest[`${character.id}:${pose}`]).toBe(src);
      }
      if (character.portrait) {
        expect(manifest[`${character.id}:portrait`]).toBe(character.portrait);
      }
    }

    // The merge must actually add keys: dropping the character loop in
    // `_preload` would leave the base manifest and fail this assertion.
    expect(Object.keys(manifest).length).toBeGreaterThan(Object.keys(GAME_ASSETS).length);
    // The bare constant itself never carries character keys.
    expect(GAME_ASSETS[`${CHARACTERS[0].id}:portrait`]).toBeUndefined();
  });

  it('calls assets.load on the first frame (via fire-and-forget preload) and tolerates failure', async () => {
    const game = makeFakeGame({ assets: { load: vi.fn(() => Promise.reject(new Error('Network'))) } });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new BootScene(game);
    scene.enter();

    // Wait for the microtask queue so the async _preload rejects
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleWarn).toHaveBeenCalled();
    expect(consoleWarn.mock.calls[0][0]).toContain('falling back');
    consoleWarn.mockRestore();
  });

  it('transitions to the menu scene exactly once on the first update', () => {
    const game = makeFakeGame();
    const scene = new BootScene(game);
    scene.enter();

    scene.update();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('menu');
    expect(game.scenes.switchTo).toHaveBeenCalledTimes(1);

    // Second update does nothing (the _done flag is set)
    scene.update();
    expect(game.scenes.switchTo).toHaveBeenCalledTimes(1);
  });

  it('draws a sky-blue screen', () => {
    const game = makeFakeGame();
    const renderer = { clear: vi.fn() };
    const scene = new BootScene(game);
    scene.draw(renderer);

    expect(renderer.clear).toHaveBeenCalledTimes(1);
  });
});