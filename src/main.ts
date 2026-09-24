import { ExplorationScene } from './scenes/exploration-scene.js';
import { initMobilePresentation } from './ui/mobile-presentation.js';
import { DEBUG } from './core/debug-flag.js';
import { EventBus, Events } from './core/event-bus.js';
import { GameLoop } from './core/game-loop.js';
import { SceneManager } from './core/scene-manager.js';
import { InputManager } from './input/input-manager.js';
import { KeyboardAdapter } from './input/keyboard-adapter.js';
import { TouchAdapter } from './input/touch-adapter.js';
import { CompositeAdapter } from './input/composite-adapter.js';
import { PhoneControlCoordinator } from './net/phone-control-coordinator.js';
import { registerLifecycleListeners } from './core/lifecycle.js';
import { CanvasRenderer } from './render/canvas-renderer.js';
import { SpriteRenderer } from './render/sprites.js';
import { AssetManager } from './core/asset-manager.js';
import { Hud } from './render/hud.js';
import { Effects } from './render/effects.js';
import { MenuOverlay } from './ui/menu.js';
import { HudControls } from './ui/hud-controls.js';
import { TouchControls } from './ui/touch-controls.js';
import { AudioManager } from './audio/audio-manager.js';
import { SpeechNarrator } from './audio/speech-narrator.js';
import { initPwaInstallListener } from './ui/pwa-install.js';
import { initPwaUpdates } from './ui/pwa-update.js';
import { createStorageAdapter } from './persistence/local-storage-adapter.js';
import { SaveStore } from './persistence/save-store.js';
import { ProfileStore } from './persistence/profile-store.js';
import { ProgressStore } from './persistence/progress-store.js';
import { AudioSettingsStore } from './persistence/audio-settings-store.js';
import { ExperienceSettingsStore } from './persistence/experience-settings-store.js';
import * as curriculum from './content/curriculum.js';
import type { Unit, Lesson } from './content/curriculum-model.js';
import { buildSpeedrunCourse } from './gameplay/speedrun-course.js';
import { BootScene } from './scenes/boot-scene.js';
import { MenuScene } from './scenes/menu-scene.js';
import { GameScene } from './scenes/game-scene.js';
import { VictoryScene } from './scenes/victory-scene.js';

/**
 * Composition root — the single place where concrete implementations are wired
 * together. Every other module receives its collaborators, which is what keeps
 * the rest of the codebase unit-testable without a browser.
 */
export interface GameContext {
  bus: EventBus;
  input: InputManager;
  renderer: CanvasRenderer;
  assets: AssetManager;
  menu: MenuOverlay;
  hudControls: HudControls;
  touchControls: TouchControls;
  audio: AudioManager;
  narrator: SpeechNarrator;
  sprites: SpriteRenderer;
  effects: Effects;
  hud: Hud;
  profiles: ProfileStore;
  progress: ProgressStore;
  experience: ExperienceSettingsStore;
  device: { isTouch: boolean };
  curriculum: {
    units: Unit[];
    lessons: Lesson[];
    lessonOrder: string[];
    getLesson: (lessonId: string | null | undefined) => Lesson | null;
  };
  debug: { enabled: boolean; toggle(): void };
  phoneControl: PhoneControlCoordinator;
  startLesson(lessonId: string | null | undefined, options?: Record<string, unknown>): void;
  startSpeedrun(): void;
  startExploration(): void;
  // `scenes` and `loop` can only be constructed once `game` itself exists
  // (SceneManager needs a `game` reference to hand to every Scene), so both
  // are attached right after this object is built, mutating it in place —
  // every consumer (SceneManager, Scene instances) holds this exact
  // reference. See the `as GameContext` cast below.
  scenes: SceneManager;
  loop: GameLoop;
}

/** True on touch devices only; never throws where matchMedia is unavailable (tests, SSR). */
function isTouchDevice(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(pointer: coarse)').matches
  );
}

interface CreateGameOptions {
  canvas: HTMLCanvasElement;
  overlayRoot: HTMLElement;
  hudControlsRoot?: HTMLElement | null;
  touchControlsRoot?: HTMLElement | null;
  storage?: Storage;
  assets?: AssetManager;
}

export function createGame({
  canvas,
  overlayRoot,
  hudControlsRoot = null,
  touchControlsRoot = null,
  storage = globalThis.localStorage,
  assets = new AssetManager(),
}: CreateGameOptions): GameContext {
  const bus = new EventBus();
  const renderer = new CanvasRenderer(canvas);
  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const storageAdapter = createStorageAdapter(storage);
  const experience = new ExperienceSettingsStore(storageAdapter);
  experience.apply();
  const reducedMotion = () => Boolean(motionPreference?.matches || experience.read().reducedMotion);
  const sprites = new SpriteRenderer({ assets, reducedMotion });
  const effects = new Effects({ reducedMotion });
  const hud = new Hud(renderer, {
    viewport: { width: canvas.width, height: canvas.height },
  });
  const input = new InputManager();
  const menu = new MenuOverlay({ root: overlayRoot });
  const hudControls = new HudControls({ root: hudControlsRoot ?? overlayRoot });
  const touchControls = new TouchControls({ root: touchControlsRoot ?? overlayRoot });

  const saves = new SaveStore({ adapter: storageAdapter });
  const profiles = new ProfileStore({ saves });
  const progress = new ProgressStore({ saves, bus });
  const audioSettings = new AudioSettingsStore({ adapter: storageAdapter });
  const audio = new AudioManager({ settings: audioSettings });
  const narrator = new SpeechNarrator({
    isMuted: () => audio.isVoiceMuted,
    volume: () => audio.voiceVolume,
    onSpeakingChange: (speaking) => {
      audio.setVoiceActive(speaking);
      if (typeof document !== 'undefined') document.body.classList.toggle('voice-speaking', speaking);
    },
  });
  initPwaInstallListener();

  // The only lines where physical input meets the game's actions. Both stay
  // attached at once (Composite) so a touch-screen laptop can use either.
  const useDefaultInput = () => {
    input.setAdapter(
      new CompositeAdapter(input.handleAction, [
        new KeyboardAdapter(input.handleAction),
        new TouchAdapter(input.handleAction, { buttons: touchControls.buttons }),
      ]),
    );
  };
  useDefaultInput();

  // Phone-control mode (docs/12-controle-por-celular.md): the coordinator swaps
  // the composite above for AutoRun+Phone once the phone pairs, and back on stop.
  const phoneControl = new PhoneControlCoordinator({ input, bus, restoreDefaultInput: useDefaultInput });

  const game = {
    bus,
    input,
    renderer,
    assets,
    menu,
    hudControls,
    touchControls,
    audio,
    narrator,
    sprites,
    effects,
    hud,
    profiles,
    progress,
    experience,
    device: {
      isTouch: isTouchDevice(),
    },
    curriculum: {
      units: curriculum.UNITS,
      lessons: curriculum.LESSONS,
      lessonOrder: curriculum.LESSON_ORDER,
      getLesson: curriculum.getLesson,
    },
    debug: {
      get enabled() {
        return DEBUG.enabled;
      },
      toggle() {
        DEBUG.enabled = !DEBUG.enabled;
      },
    },
    phoneControl,
    /** Jump to a lesson by id (used by menus and the victory screen). */
    startLesson(lessonId: string | null | undefined, options: Record<string, unknown> = {}) {
      scenes.switchTo('game', { lessonId, ...options });
    },
    /** Start a continuous speedrun through the alphabet lessons (A to Z). */
    startExploration() { scenes.switchTo('exploration'); },
    startSpeedrun() {
      const course = buildSpeedrunCourse();
      scenes.switchTo('game', {
        mode: 'speedrun',
        speedrunCourse: course,
      });
    },
    // `scenes` and `loop` are attached right after construction below (see the
    // `GameContext` doc comment) — cast now so those later assignments type-check.
  } as GameContext;

  const scenes = new SceneManager(game, bus);
  game.scenes = scenes;

  scenes.register('boot', BootScene);
  scenes.register('menu', MenuScene);
  scenes.register('game', GameScene);
  scenes.register('exploration', ExplorationScene);
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

  registerLifecycleListeners({ bus, input, audio });

  scenes.switchTo('boot');

  return game;
}

// Bootstrap when the module is loaded by index.html. Guarded on the canvas so
// importing this module (tests, tooling) never requires a real page.
const bootCanvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
const bootOverlay = typeof document !== 'undefined' ? document.getElementById('overlay-root') : null;
const bootHudControls = typeof document !== 'undefined' ? document.getElementById('hud-controls-root') : null;
const bootTouchControls =
  typeof document !== 'undefined' ? document.getElementById('touch-controls-root') : null;

function dismissSplashScreen(): void {
  const splash = typeof document !== 'undefined' ? document.getElementById('splash-screen') : null;
  if (!splash) return;
  splash.classList.add('splash-fade-out');
  setTimeout(() => splash.remove(), 550);
}

if (bootCanvas && bootOverlay) {
  const game = createGame({
    canvas: bootCanvas as HTMLCanvasElement,
    overlayRoot: bootOverlay as HTMLElement,
    hudControlsRoot: bootHudControls as HTMLElement | null,
    touchControlsRoot: bootTouchControls as HTMLElement | null,
  });
  initMobilePresentation({
    bus: game.bus, isTouch: game.device.isTouch,
    pause: () => game.bus.emit(Events.APP_BLURRED, undefined),
    resetInput: () => game.input.reset(),
    goToMenu: () => game.scenes.switchTo('menu'),
  });
  document.body.dataset.scene = game.scenes.currentName ?? 'boot';
  game.loop.start();
  void initPwaUpdates(game);

  if (typeof window !== 'undefined') {
    setTimeout(dismissSplashScreen, 1400);
    const splash = document.getElementById('splash-screen');
    splash?.addEventListener('pointerdown', dismissSplashScreen, { once: true });
  }
}
