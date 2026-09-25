// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';

import { createGame } from './main.js';
import { Actions } from './input/actions.js';
import { AssetManager } from './core/asset-manager.js';

/**
 * End-to-end smoke test of the wired game.
 *
 * This is the only test that uses a DOM (jsdom); every other suite stays pure.
 * It drives the real input path — physical KeyboardEvent -> KeyboardAdapter ->
 * InputManager -> GameScene -> PlayerController -> PhysicsEngine — so it also
 * proves the abstraction actually works, not just that the units do.
 */

const DT = 1 / 60;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => createFakeContext();
});

/** Canvas context stub: records nothing, accepts any call or property set. */
function createFakeContext() {
  const state = {};
  const noop = () => {};
  const base = {
    measureText: (text) => ({ width: String(text).length * 8 }),
  };
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
    <div class="game-viewport"><canvas id="game-canvas" width="960" height="540"></canvas>
    <div id="overlay-root"></div></div>
  `;
  const canvas = document.getElementById('game-canvas');
  const overlayRoot = document.getElementById('overlay-root');
  // Real character art never loads in jsdom (no network); stub the loader so
  // BootScene's preload resolves instantly with fake image dimensions.
  const assets = new AssetManager(() => Promise.resolve({ width: 40, height: 60 }));
  return createGame({ canvas, overlayRoot, storage: createFakeStorage(), assets });
}

function press(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

function release(code) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

function tick(game, frames = 1) {
  for (let i = 0; i < frames; i += 1) game.loop.advance(DT);
}

function overlayText(selector) {
  return document.querySelector(selector)?.textContent ?? null;
}

/** Enter the first lesson and return its running scene. */
function enterFirstLesson(game) {
  const lessonId = game.curriculum.lessonOrder[0];
  game.startLesson(lessonId);
  tick(game);
  return game.scenes.current;
}

/** Drops the player onto the (already open, fully grown) portal, as running into it would. */
function enterPortal(scene) {
  scene.stream.tick(1);
  scene.player.body.x = scene.level.finish.x;
  scene.player.body.y = scene.level.finish.y;
}

describe('game integration', () => {
  it('boots from the boot scene into the pt-BR main menu', () => {
    const game = mountGame();
    tick(game, 2);
    expect(game.scenes.currentName).toBe('menu');
    // First run shows the parental privacy notice before any profile exists.
    expect(overlayText('.privacy-notice h2')).toContain('responsáveis');
    expect(game.profiles.hasParentalConsent()).toBe(false);
    // After the responsible adult confirms, the main menu appears.
    game.menu.triggerPrimary();
    tick(game, 1);
    expect(game.profiles.hasParentalConsent()).toBe(true);
    expect(overlayText('.overlay h1')).toContain('Aventura do Nicolas&Eloá');
  });

  it('enters a lesson from the curriculum and loads its level file', () => {
    const game = mountGame();
    tick(game, 2);
    const scene = enterFirstLesson(game);

    expect(scene.lesson.id).toBe('alfabeto-a');
    expect(scene.level.id).toBe('fase-alfabeto-a');
    expect(scene.level.portalActive).toBe(false);
    expect(scene.status).toBe('running');
  });

  it('walks and jumps from real keyboard events only', () => {
    const game = mountGame();
    tick(game, 2);
    const scene = enterFirstLesson(game);

    // Settle on the ground.
    tick(game, 30);
    expect(scene.player.grounded).toBe(true);

    const startX = scene.player.body.x;
    press('ArrowRight');
    tick(game, 12);
    release('ArrowRight');
    expect(scene.player.body.x).toBeGreaterThan(startX);

    // Let it stop, then jump and hold so the jump is not cut short.
    tick(game, 5);
    press('Space');
    tick(game, 2);
    expect(scene.player.body.vy).toBeLessThan(0);
    expect(scene.player.state).toBe('jump');
    release('Space');
  });

  it('loses a heart when collecting the wrong item, and keeps playing', () => {
    const game = mountGame();
    tick(game, 2);
    const scene = enterFirstLesson(game);
    tick(game, 30);

    const distractor = scene.level.items.find((item) => item.type === 'distractor');
    scene.player.body.x = distractor.x;
    scene.player.body.y = distractor.y;
    tick(game, 1);

    expect(scene.lives.lives).toBe(2);
    expect(scene.status).toBe('running');
    expect(scene.mistakes).toBe(1);
  });

  it('completes the lesson on the right item, celebrates and advances', () => {
    const game = mountGame();
    tick(game, 2);
    const profile = game.profiles.createProfile('Teste');
    const scene = enterFirstLesson(game);
    tick(game, 30);

    const target = scene.level.items.find((item) => item.type === 'target');
    scene.player.body.x = target.x;
    scene.player.body.y = target.y;
    tick(game, 1);

    // The lesson is not over yet: the portal opened and the child has to reach it.
    expect(scene.status).toBe('running');
    expect(scene.portalOpen).toBe(true);
    expect(scene.lives.lives).toBe(scene.lives.maxLives);
    // The portal cleared every letter from the way, and forgot their collected ids with them.
    expect(scene.level.items).toEqual([]);
    expect(scene.levelManager.collected.size).toBe(0);
    enterPortal(scene);
    tick(game, 1);
    expect(scene.status).toBe('won');

    // Celebration runs, then the victory screen takes over.
    tick(game, 200);
    expect(game.scenes.currentName).toBe('victory');
    expect(overlayText('.overlay h1')).toContain('Muito bem');
    expect(game.progress.isLessonComplete(profile.id, scene.lesson.id)).toBe(true);
    expect(game.progress.getLessonProgress(profile.id, scene.lesson.id).stars).toBe(3);
  });

  it('falling into a pit respawns without costing a heart', () => {
    const game = mountGame();
    tick(game, 2);
    const scene = enterFirstLesson(game);
    tick(game, 30);

    const livesBefore = scene.lives.lives;
    scene.player.body.y = scene.level.worldHeight + 100;
    tick(game, 1);

    expect(scene.lives.lives).toBe(livesBefore);
    expect(scene.player.body.y).toBe(scene.level.checkpoint.y);
  });

  it('pauses and resumes through the abstracted PAUSE action', () => {
    const game = mountGame();
    tick(game, 2);
    const scene = enterFirstLesson(game);

    press('Escape');
    tick(game, 1);
    expect(scene.status).toBe('paused');
    expect(overlayText('.overlay h2')).toContain('Pausa');

    press('Escape');
    tick(game, 1);
    expect(scene.status).toBe('running');
    release('Escape');
  });

  it('toggles the debug overlay through a semantic action', () => {
    const game = mountGame();
    tick(game, 2);
    enterFirstLesson(game);
    expect(game.debug.enabled).toBe(false);

    press('F2');
    tick(game, 1);
    expect(game.debug.enabled).toBe(true);
    release('F2');
  });

  it('starts the next lesson after a victory', () => {
    const game = mountGame();
    tick(game, 2);
    game.profiles.createProfile('Teste');
    const scene = enterFirstLesson(game);
    tick(game, 30);

    const target = scene.level.items.find((item) => item.type === 'target');
    scene.player.body.x = target.x;
    scene.player.body.y = target.y;
    tick(game, 2);
    enterPortal(scene);
    tick(game, 300);

    expect(game.scenes.currentName).toBe('victory');
    game.scenes.current.game.menu.triggerPrimary(); // "Próxima fase"
    tick(game, 1);

    expect(game.scenes.currentName).toBe('game');
    expect(game.scenes.current.lesson.id).toBe(game.curriculum.lessonOrder[1]);
  });

  it('never lets an abstracted jump fire while airborne', () => {
    const game = mountGame();
    tick(game, 2);
    const scene = enterFirstLesson(game);
    tick(game, 30);

    press('Space');
    tick(game, 1);
    const afterFirstJump = scene.player.body.vy;

    // Hold and hammer jump: a double jump would make vy more negative again.
    let reaccelerated = false;
    for (let i = 0; i < 8; i += 1) {
      scene.player.jump();
      tick(game, 1);
      if (scene.player.body.vy < afterFirstJump - 1) reaccelerated = true;
    }
    release('Space');

    expect(reaccelerated).toBe(false);
    expect(scene.lives.lives).toBe(3);
    expect(Actions.JUMP).toBe('jump');
  });

  it('runs speedrun mode continuously through letters without resetting player position', () => {
    const game = mountGame();
    tick(game, 2);
    game.profiles.createProfile('Veloz');
    game.startSpeedrun();
    tick(game, 5);

    expect(game.scenes.currentName).toBe('game');
    const scene = game.scenes.current;
    expect(scene.mode).toBe('speedrun');
    expect(scene.lesson.target).toBe('A');
    expect(scene.hudModel.isSpeedrun).toBe(true);
    expect(scene.hudModel.speedrunProgress).toBe('1/26');

    // The one live target is 'A'
    const targetA = scene.stream.liveTarget;
    expect(targetA.label).toBe('A');
    const collectedX = targetA.x;
    scene.player.body.x = targetA.x;
    scene.player.body.y = targetA.y;
    tick(game, 5);

    // Goal advances to B instantly while player remains on course
    expect(scene.currentIndex).toBe(1);
    expect(scene.lesson.target).toBe('B');
    expect(scene.hudModel.speedrunProgress).toBe('2/26');
    // Player position did NOT reset to starting 96!
    expect(scene.player.body.x).toBeCloseTo(collectedX, 0);
  });
});
