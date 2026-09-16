import { EventBus, Events } from './core/event-bus.js';
import { GameLoop } from './core/game-loop.js';
import { SceneManager } from './core/scene-manager.js';
import { InputManager } from './input/input-manager.js';
import { KeyboardAdapter } from './input/keyboard-adapter.js';
import { CanvasRenderer } from './render/canvas-renderer.js';
import { SpriteRenderer } from './render/sprites.js';
import { AssetManager } from './core/asset-manager.js';
import { Hud } from './render/hud.js';
import { Effects } from './render/effects.js';
import { MenuOverlay } from './ui/menu.js';
import { createStorageAdapter } from './persistence/local-storage-adapter.js';
import { SaveStore } from './persistence/save-store.js';
import { ProfileStore } from './persistence/profile-store.js';
import { ProgressStore } from './persistence/progress-store.js';
import * as curriculum from './content/curriculum.js';
import { buildSpeedrunCourse } from './gameplay/speedrun-course.js';
import { BootScene } from './scenes/boot-scene.js';
import { MenuScene } from './scenes/menu-scene.js';
import { GameScene } from './scenes/game-scene.js';
import { VictoryScene } from './scenes/victory-scene.js';

/**
 * Composition root — the single place where concrete implementations are wired
 * together. Every other module receives its collaborators, which is what keeps
 * the rest of the codebase unit-testable without a browser.
 *
 * @typedef {ReturnType<typeof createGame>} GameContext
 */
export function createGame({ canvas, overlayRoot, storage = globalThis.localStorage, assets = new AssetManager() }) {
  const bus = new EventBus();
  const renderer = new CanvasRenderer(canvas);
  const sprites = new SpriteRenderer({ assets });
  const effects = new Effects();
  const hud = new Hud(renderer, {
    viewport: { width: canvas.width, height: canvas.height },
  });
  const input = new InputManager();
  const menu = new MenuOverlay({ root: overlayRoot });

  const saves = new SaveStore({ adapter: createStorageAdapter(storage) });
  const profiles = new ProfileStore({ saves });
  const progress = new ProgressStore({ saves, bus });

  const game = {
    bus,
    input,
    renderer,
    assets,
    menu,
    sprites,
    effects,
    hud,
    profiles,
    progress,
    curriculum: {
      units: curriculum.UNITS,
      lessons: curriculum.LESSONS,
      lessonOrder: curriculum.LESSON_ORDER,
      getLesson: curriculum.getLesson,
    },
    debug: {
      enabled: false,
      toggle() {
        this.enabled = !this.enabled;
      },
    },
    /** Jump to a lesson by id (used by menus and the victory screen). */
    startLesson(lessonId, options = {}) {
      scenes.switchTo('game', { lessonId, ...options });
    },
    /** Start a continuous speedrun through the alphabet lessons (A to Z). */
    startSpeedrun() {
      const course = buildSpeedrunCourse();
      scenes.switchTo('game', {
        mode: 'speedrun',
        speedrunCourse: course,
      });
    },
  };

  const scenes = new SceneManager(game, bus);
  game.scenes = scenes;

  scenes.register('boot', BootScene);
  scenes.register('menu', MenuScene);
  scenes.register('game', GameScene);
  scenes.register('victory', VictoryScene);

  const loop = new GameLoop({
    update: (dt) => {
      scenes.update(dt);
      // One-shot presses belong to a single simulated step. Dropping unread
      // ones here guarantees a stale press can never fire in a later frame.
      input.endFrame();
    },
    render: () => scenes.draw(renderer),
  });
  game.loop = loop;

  // The only line where a physical keyboard meets the game's actions.
  input.setAdapter(new KeyboardAdapter(input.handleAction));

  const handleBlur = () => {
    input.reset();
    bus.emit(Events.APP_BLURRED);
  };
  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleBlur();
    else bus.emit(Events.APP_FOCUSED);
  });

  scenes.switchTo('boot');

  return game;
}

// Bootstrap when the module is loaded by index.html. Guarded on the canvas so
// importing this module (tests, tooling) never requires a real page.
const bootCanvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
const bootOverlay = typeof document !== 'undefined' ? document.getElementById('overlay-root') : null;

if (bootCanvas && bootOverlay) {
  const game = createGame({ canvas: bootCanvas, overlayRoot: bootOverlay });
  game.loop.start();
}
