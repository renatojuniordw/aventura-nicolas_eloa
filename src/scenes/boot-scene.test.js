import { describe, it, expect, vi } from 'vitest';
import { BootScene } from './boot-scene.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter } from '../content/characters.js';
import { WORLD_ASSETS, characterAssets } from '../render/asset-plan.js';

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
  it('preloads only the world art and the default character, not every background or portrait', () => {
    const game = makeFakeGame();
    const scene = new BootScene(game);
    scene.enter();

    // Fire-and-forget: the manifest reaches assets.load synchronously, before
    // the first await, so it is inspectable right after enter().
    expect(game.assets.load).toHaveBeenCalledTimes(1);
    const manifest = game.assets.load.mock.calls[0][0];

    expect(manifest).toMatchObject(WORLD_ASSETS);
    expect(manifest).toMatchObject(characterAssets(getCharacter(DEFAULT_CHARACTER_ID)));
    // Lesson-specific art (backgrounds, the other character) waits for its lesson.
    expect(Object.keys(manifest).some((key) => key.startsWith('bg:'))).toBe(false);
    const other = CHARACTERS.find((character) => character.id !== DEFAULT_CHARACTER_ID);
    expect(Object.keys(manifest).some((key) => key.startsWith(`${other.id}:`))).toBe(false);
    expect(Object.keys(manifest).some((key) => key.endsWith(':portrait'))).toBe(false);
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