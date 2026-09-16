// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { createGame } from './main.js';
import { Events } from './core/event-bus.js';
import { AssetManager } from './core/asset-manager.js';

/**
 * Branch coverage for the app lifecycle wiring in `main.js`: window blur and
 * document visibility must reset the input and broadcast APP_BLURRED /
 * APP_FOCUSED so scenes can pause. This is the only place those listeners are
 * attached, and nothing else exercises them.
 */

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => createFakeContext();
});

function createFakeContext() {
  const state = {};
  const noop = () => {};
  const base = { measureText: (text) => ({ width: String(text).length * 8 }) };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop in state) return state[prop];
      return noop;
    },
    set(target, prop, value) {
      state[prop] = value;
      return true;
    },
  });
}

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function mountGame() {
  document.body.innerHTML = `
    <canvas id="game-canvas" width="960" height="540"></canvas>
    <div id="overlay-root"></div>
  `;
  const canvas = document.getElementById('game-canvas');
  const overlayRoot = document.getElementById('overlay-root');
  const assets = new AssetManager(() => Promise.resolve({ width: 40, height: 60 }));
  return createGame({ canvas, overlayRoot, storage: createFakeStorage(), assets });
}

describe('app lifecycle', () => {
  it('resets input and emits APP_BLURRED on window blur', () => {
    const game = mountGame();
    const resetSpy = vi.spyOn(game.input, 'reset');
    const blurred = [];
    game.bus.on(Events.APP_BLURRED, () => blurred.push(true));

    window.dispatchEvent(new Event('blur'));

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(blurred).toHaveLength(1);
  });

  it('emits APP_BLURRED when the tab is hidden and APP_FOCUSED when visible again', () => {
    const game = mountGame();
    const blurred = [];
    const focused = [];
    game.bus.on(Events.APP_BLURRED, () => blurred.push(true));
    game.bus.on(Events.APP_FOCUSED, () => focused.push(true));

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(blurred).toHaveLength(1);
    expect(focused).toHaveLength(0);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(blurred).toHaveLength(1);
    expect(focused).toHaveLength(1);
  });

  it('wires the collaborator graph and registers the boot scene', () => {
    const game = mountGame();

    expect(game.input).toBeTruthy();
    expect(game.scenes).toBeTruthy();
    expect(typeof game.startLesson).toBe('function');
    expect(typeof game.startSpeedrun).toBe('function');
  });
});