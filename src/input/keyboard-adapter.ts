import { InputAdapter, type OnAction } from './input-adapter.js';
import { DEFAULT_KEYMAP, translateKey } from './keyboard-keymap.js';

interface KeyboardAdapterOptions {
  target?: EventTarget;
  keymap?: Record<string, string>;
}

/**
 * Keyboard implementation of InputAdapter.
 *
 * This file is intentionally logic-free: it listens to the DOM, translates a
 * physical key into a semantic action, and forwards it. It contains NO jump
 * logic, NO movement logic — those live in the PlayerController. This is what
 * makes the input layer swappable.
 */
export class KeyboardAdapter extends InputAdapter {
  private _target: EventTarget;
  private _keymap: Record<string, string>;
  private _attached = false;

  constructor(onAction: OnAction, { target = globalThis, keymap = DEFAULT_KEYMAP }: KeyboardAdapterOptions = {}) {
    super(onAction);
    this._target = target;
    this._keymap = keymap;
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
  }

  override attach(): void {
    if (this._attached) return;
    this._target.addEventListener('keydown', this._handleKeyDown as EventListener);
    this._target.addEventListener('keyup', this._handleKeyUp as EventListener);
    this._attached = true;
  }

  override detach(): void {
    if (!this._attached) return;
    this._target.removeEventListener('keydown', this._handleKeyDown as EventListener);
    this._target.removeEventListener('keyup', this._handleKeyUp as EventListener);
    this._attached = false;
  }

  private _usesNativeKeyboard(event: KeyboardEvent): boolean {
    const target = event.target;
    if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return true;
    return (event.code === 'Enter' || event.code === 'Space') && Boolean(target.closest('button, a[href], summary'));
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (this._usesNativeKeyboard(event)) return;
    const action = translateKey(event.code, this._keymap);
    if (!action) return;
    // Stop the browser from scrolling the page on Space/Arrows.
    event.preventDefault();
    this.onAction(action, { pressed: true, repeated: event.repeat === true });
  }

  private _handleKeyUp(event: KeyboardEvent): void {
    const action = translateKey(event.code, this._keymap);
    if (!action) return;
    // Release held movement even if focus moved to a control after keydown.
    if (!this._usesNativeKeyboard(event)) event.preventDefault();
    this.onAction(action, { pressed: false, repeated: false });
  }
}
