import { DEBUG } from './core/debug-flag.js';
import { EventBus, Events } from './core/event-bus.js';
import { GameLoop } from './core/game-loop.js';
import { SceneManager } from './core/scene-manager.js';
import { InputManager } from './input/input-manager.js';
import { KeyboardAdapter } from './input/keyboard-adapter.js';
import { TouchAdapter } from './input/touch-adapter.js';
import { CompositeAdapter } from './input/composite-adapter.js';
import { PhoneAdapter } from './input/phone-adapter.js';
import { AutoRunAdapter } from './input/auto-run-adapter.js';
import { startPhoneControlSession, type PhoneControlHandle } from './net/phone-control-session.js';
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
  device: { isTouch: boolean };
  curriculum: {
    units: Unit[];
    lessons: Lesson[];
    lessonOrder: string[];
    getLesson: (lessonId: string | null | undefined) => Lesson | null;
  };
  debug: { enabled: boolean; toggle(): void };
  phoneControl: {
    readonly isActive: boolean;
    start(callbacks: PhoneControlUiCallbacks): {
      session: string;
      pairingUrl: string;
      measureLatency(): Promise<number | null>;
    };
    stop(): void;
  };
  startLesson(lessonId: string | null | undefined, options?: Record<string, unknown>): void;
  startSpeedrun(): void;
  // `scenes` and `loop` can only be constructed once `game` itself exists
  // (SceneManager needs a `game` reference to hand to every Scene), so both
  // are attached right after this object is built, mutating it in place —
  // every consumer (SceneManager, Scene instances) holds this exact
  // reference. See the `as GameContext` cast below.
  scenes: SceneManager;
  loop: GameLoop;
}

interface PhoneControlUiCallbacks {
  onPaired(): void;
  onDisconnected(): void;
  onError(message: string): void;
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
  const sprites = new SpriteRenderer({ assets });
  const effects = new Effects();
  const hud = new Hud(renderer, {
    viewport: { width: canvas.width, height: canvas.height },
  });
  const input = new InputManager();
  const menu = new MenuOverlay({ root: overlayRoot });
  const hudControls = new HudControls({ root: hudControlsRoot ?? overlayRoot });
  const touchControls = new TouchControls({ root: touchControlsRoot ?? overlayRoot });

  const storageAdapter = createStorageAdapter(storage);
  const saves = new SaveStore({ adapter: storageAdapter });
  const profiles = new ProfileStore({ saves });
  const progress = new ProgressStore({ saves, bus });
  const audioSettings = new AudioSettingsStore({ adapter: storageAdapter });
  const audio = new AudioManager({ settings: audioSettings });
  const narrator = new SpeechNarrator({ isMuted: () => audio.isMuted });
  initPwaInstallListener();

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
    phoneControl: {
      get isActive() {
        return phoneActive;
      },
      start: (callbacks: PhoneControlUiCallbacks) => startPhoneControl(callbacks),
      stop: () => stopPhoneControl(),
    },
    /** Jump to a lesson by id (used by menus and the victory screen). */
    startLesson(lessonId: string | null | undefined, options: Record<string, unknown> = {}) {
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
    // `scenes` and `loop` are attached right after construction below (see the
    // `GameContext` doc comment) — cast now so those later assignments type-check.
  } as GameContext;

  const scenes = new SceneManager(game as never, bus);
  game.scenes = scenes;

  scenes.register('boot', BootScene as never);
  scenes.register('menu', MenuScene as never);
  scenes.register('game', GameScene as never);
  scenes.register('victory', VictoryScene as never);

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

  // Phone-control mode (docs/12-controle-por-celular.md): once the phone
  // pairs, the keyboard/touch composite above is replaced by AutoRun+Phone —
  // production guidance is to never mix them, since InputManager's "held"
  // state is one shared boolean per action (see auto-run-adapter.ts), not
  // per source. `net/phone-control-session.ts` only owns the socket; this
  // closure owns everything gameplay-facing: swapping the adapter in, and
  // pausing (reusing the existing blur-pause path) if the phone drops mid
  // session so auto-run never runs the character into an obstacle unwatched.
  let phoneHandle: PhoneControlHandle | null = null;
  let phoneActive = false;

  const startPhoneControl = (callbacks: PhoneControlUiCallbacks) => {
    stopPhoneControl();
    phoneHandle = startPhoneControlSession({
      onPaired: () => {
        if (!phoneActive && phoneHandle) {
          phoneActive = true;
          input.setAdapter(
            new CompositeAdapter(input.handleAction, [
              new AutoRunAdapter(input.handleAction),
              new PhoneAdapter(input.handleAction, { transport: phoneHandle.transport }),
            ]),
          );
        }
        callbacks.onPaired();
      },
      onDisconnected: () => {
        if (phoneActive) bus.emit(Events.APP_BLURRED);
        callbacks.onDisconnected();
      },
      onError: callbacks.onError,
    });
    return {
      session: phoneHandle.session,
      pairingUrl: phoneHandle.pairingUrl,
      measureLatency: () => phoneHandle!.measureLatency(),
    };
  };

  const stopPhoneControl = () => {
    phoneHandle?.stop();
    phoneHandle = null;
    if (phoneActive) {
      phoneActive = false;
      useDefaultInput();
    }
  };

  const handleBlur = () => {
    input.reset();
    bus.emit(Events.APP_BLURRED);
  };
  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleBlur();
    else bus.emit(Events.APP_FOCUSED);
  });

  // Mobile browsers block Audio.play() outside a user gesture. This unlocks
  // it on the very first tap/click of the session, whichever element it
  // lands on, so every playMusic/playSfx call afterwards just works.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

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
  game.loop.start();
  void initPwaUpdates(game);

  if (typeof window !== 'undefined') {
    setTimeout(dismissSplashScreen, 1400);
    const splash = document.getElementById('splash-screen');
    splash?.addEventListener('pointerdown', dismissSplashScreen, { once: true });
  }
}
