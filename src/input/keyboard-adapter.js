import { InputAdapter } from './input-adapter.js';
import { DEFAULT_KEYMAP, translateKey } from './keyboard-keymap.js';

/**
 * Keyboard implementation of InputAdapter.
 *
 * This file is intentionally logic-free: it listens to the DOM, translates a
 * physical key into a semantic action, and forwards it. It contains NO jump
 * logic, NO movement logic — those live in the PlayerController. This is what
 * makes the input layer swappable.
 */
export class KeyboardAdapter extends InputAdapter {
  /**
   * @param {(action: string, meta: { pressed: boolean, repeated: boolean }) => void} onAction
   * @param {{ target?: EventTarget, keymap?: Record<string, string> }} [options]
   */
  constructor(onAction, { target = globalThis, keymap = DEFAULT_KEYMAP } = {}) {
    super(onAction);
    this._target = target;
    this._keymap = keymap;
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this._attached = false;
  }

  attach() {
    if (this._attached) return;
    this._target.addEventListener('keydown', this._handleKeyDown);
    this._target.addEventListener('keyup', this._handleKeyUp);
    this._attached = true;
  }

  detach() {
    if (!this._attached) return;
    this._target.removeEventListener('keydown', this._handleKeyDown);
    this._target.removeEventListener('keyup', this._handleKeyUp);
    this._attached = false;
  }

  _handleKeyDown(event) {
    const action = translateKey(event.code, this._keymap);
    if (!action) return;
    // Stop the browser from scrolling the page on Space/Arrows.
    event.preventDefault();
    this.onAction(action, { pressed: true, repeated: event.repeat === true });
  }

  _handleKeyUp(event) {
    const action = translateKey(event.code, this._keymap);
    if (!action) return;
    event.preventDefault();
    this.onAction(action, { pressed: false, repeated: false });
  }
}
