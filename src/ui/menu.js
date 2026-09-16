import { clear } from './dom.js';
import { buildMainMenuScreen } from './screens/main-menu.js';
import { buildCharacterPickerScreen } from './screens/character-picker.js';
import { buildLessonPickerScreen } from './screens/lesson-picker.js';
import { buildPauseScreen } from './screens/pause.js';
import { buildGameOverScreen } from './screens/game-over.js';
import { buildVictoryScreen, buildSpeedrunVictoryScreen } from './screens/victory.js';
import { buildPrivacyNoticeScreen } from './screens/privacy-notice.js';

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
 * `ui/screens/`, so growing or reskinning one screen never touches the rest.
 */
export class MenuOverlay {
  /** @param {{ root: HTMLElement }} options */
  constructor({ root }) {
    this._root = root;
    this._visible = false;
    this._primary = null;
    this._back = null;
    this._cleanup = null;
  }

  get isVisible() {
    return this._visible;
  }

  hide() {
    this._cleanup?.();
    this._cleanup = null;
    clear(this._root);
    this._visible = false;
    this._primary = null;
    this._back = null;
  }

  triggerPrimary() {
    this._primary?.();
  }

  triggerBack() {
    this._back?.();
  }

  _mount(node, { primary = null, back = null, cleanup = null } = {}) {
    this._cleanup?.();
    this._cleanup = cleanup;
    clear(this._root);
    this._root.append(node);
    this._primary = primary;
    this._back = back;
    this._visible = true;
  }

  // --- Screens -------------------------------------------------------------

  showMainMenu(options) {
    const { node, primary, back, cleanup } = buildMainMenuScreen(options);
    this._mount(node, { primary, back, cleanup });
  }

  showCharacterPicker(options) {
    const { node, primary, back } = buildCharacterPickerScreen(options);
    this._mount(node, { primary, back });
  }

  /**
   * @param {{ units: Array, isUnlocked: (lessonId: string) => boolean, onPick, onBack }} options
   */
  showLessonPicker(options) {
    const { node, primary, back } = buildLessonPickerScreen(options);
    this._mount(node, { primary, back });
  }

  showPause(options) {
    this._renderPauseScreen('menu', options);
  }

  _renderPauseScreen(step, options) {
    const goTo = (nextStep) => this._renderPauseScreen(nextStep, options);
    const { node, primary, back } = buildPauseScreen(step, options, goTo);
    this._mount(node, { primary, back });
  }

  showGameOver(options) {
    const { node, primary, back } = buildGameOverScreen(options);
    this._mount(node, { primary, back });
  }

  showVictory(options) {
    const { node, primary, back } = buildVictoryScreen(options);
    this._mount(node, { primary, back });
  }

  showSpeedrunVictory(options) {
    const { node, primary, back } = buildSpeedrunVictoryScreen(options);
    this._mount(node, { primary, back });
  }

  showPrivacyNotice(options) {
    const { node, primary, back } = buildPrivacyNoticeScreen(options);
    this._mount(node, { primary, back });
  }
}
