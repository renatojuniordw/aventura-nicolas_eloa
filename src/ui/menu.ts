import { clear } from './dom.js';
import { buildMainMenuScreen } from './screens/main-menu.js';
import { buildCharacterPickerScreen } from './screens/character-picker.js';
import { buildLessonPickerScreen } from './screens/lesson-picker.js';
import { buildPauseScreen, type PauseStep } from './screens/pause.js';
import { buildGameOverScreen } from './screens/game-over.js';
import { buildVictoryScreen, buildSpeedrunVictoryScreen } from './screens/victory.js';
import { buildPrivacyNoticeScreen } from './screens/privacy-notice.js';
import { buildPhonePairingScreen } from './screens/phone-pairing.js';
import { buildSettingsScreen } from './screens/settings.js';

interface ScreenResult {
  node: HTMLElement;
  primary?: (() => void) | null;
  back?: (() => void) | null;
  cleanup?: (() => void) | null;
}

interface MenuOverlayOptions {
  root: HTMLElement;
}

/**
 * DOM overlay screens: main menu, character picker, phase picker, pause, game
 * over and victory. All copy is in Brazilian Portuguese.
 *
 * Screens are click-driven AND keyboard-driven: each mounted screen registers a
 * primary and a back action, which the scenes trigger from the abstracted
 * CONFIRM/BACK actions. So menus obey the same input abstraction as gameplay.
 *
 * This class only mounts/unmounts screens and wires their primary/back
 * actions; each screen's DOM and copy live in its own module under
 * `ui/screens/` (React components today), so growing or reskinning one
 * screen never touches the rest. `cleanup` (always `root.unmount()` for a
 * React screen) is what tears down the previous screen's React root when a
 * new one mounts — every `showX` here must forward it, or the mounted
 * React root leaks and any of its effects (timers, rAF loops) keep running
 * detached from the DOM.
 */
export class MenuOverlay {
  private _root: HTMLElement;
  private _visible = false;
  private _primary: (() => void) | null = null;
  private _back: (() => void) | null = null;
  private _cleanup: (() => void) | null = null;

  constructor({ root }: MenuOverlayOptions) {
    this._root = root;
  }

  get isVisible(): boolean {
    return this._visible;
  }

  hide(): void {
    this._cleanup?.();
    this._cleanup = null;
    clear(this._root);
    this._visible = false;
    this._setGameplayControlsInert(false);
    this._primary = null;
    this._back = null;
    document.getElementById('game-canvas')?.focus({ preventScroll: true });
  }

  private _setGameplayControlsInert(inert: boolean): void {
    for (const id of ['hud-controls-root', 'touch-controls-root']) {
      const controls = document.getElementById(id);
      if (controls && controls !== this._root) controls.inert = inert;
    }
  }

  triggerPrimary(): void {
    this._primary?.();
  }

  triggerBack(): void {
    this._back?.();
  }

  private _mount(node: HTMLElement, { primary = null, back = null, cleanup = null }: Omit<ScreenResult, 'node'> = {}): void {
    this._cleanup?.();
    this._cleanup = cleanup ?? null;
    clear(this._root);
    this._root.append(node);
    this._primary = primary ?? null;
    this._back = back ?? null;
    this._visible = true;
    this._setGameplayControlsInert(true);
    const primaryButton = node.querySelector<HTMLElement>('.btn-primary-gold') ?? node.querySelector<HTMLElement>('button, [href], input');
    primaryButton?.focus({ preventScroll: true });
  }

  /** Builds a screen from its options and mounts it with the actions it returned. */
  private _show<Options>(build: (options: Options) => ScreenResult, options: Options): void {
    const { node, ...actions } = build(options);
    this._mount(node, actions);
  }

  // --- Screens -------------------------------------------------------------

  showMainMenu(options: Parameters<typeof buildMainMenuScreen>[0]): void {
    this._show(buildMainMenuScreen, options);
  }

  showCharacterPicker(options: Parameters<typeof buildCharacterPickerScreen>[0]): void {
    this._show(buildCharacterPickerScreen, options);
  }

  showLessonPicker(options: Parameters<typeof buildLessonPickerScreen>[0]): void {
    this._show(buildLessonPickerScreen, options);
  }

  showPause(options: Parameters<typeof buildPauseScreen>[1]): void {
    this._renderPauseScreen('menu', options);
  }

  private _renderPauseScreen(step: PauseStep, options: Parameters<typeof buildPauseScreen>[1]): void {
    const goTo = (nextStep: PauseStep) => this._renderPauseScreen(nextStep, options);
    this._show((screenOptions) => buildPauseScreen(step, screenOptions, goTo), options);
  }

  showGameOver(options: Parameters<typeof buildGameOverScreen>[0]): void {
    this._show(buildGameOverScreen, options);
  }

  showVictory(options: Parameters<typeof buildVictoryScreen>[0]): void {
    this._show(buildVictoryScreen, options);
  }

  showSpeedrunVictory(options: Parameters<typeof buildSpeedrunVictoryScreen>[0]): void {
    this._show(buildSpeedrunVictoryScreen, options);
  }

  showPrivacyNotice(options: Parameters<typeof buildPrivacyNoticeScreen>[0]): void {
    this._show(buildPrivacyNoticeScreen, options);
  }

  showPhonePairing(options: Parameters<typeof buildPhonePairingScreen>[0]): void {
    this._show(buildPhonePairingScreen, options);
  }

  showSettings(options: Parameters<typeof buildSettingsScreen>[0]): void {
    this._show(buildSettingsScreen, options);
  }
}
