import { clear, el } from './dom.js';
import { Actions } from '../input/actions.js';

/**
 * On-screen D-pad + jump button, mounted in its own root (separate from
 * HudControls' root, which HudControls clears wholesale for the pause
 * button — these have an independent lifetime: visible for the whole
 * session on a touch device, not tied to any one scene).
 *
 * Exposes `buttons` so a TouchAdapter can wire pointer events to the exact
 * same elements the player sees; this module never talks to InputManager
 * directly, keeping DOM and input translation separate (Single
 * Responsibility).
 */
export class TouchControls {
  /** @param {{ root: HTMLElement }} options */
  constructor({ root }) {
    this._root = root;
    this._left = el('button', {
      class: 'touch-btn touch-btn-left',
      type: 'button',
      tabindex: '-1',
      'aria-label': 'Andar para a esquerda',
      text: '◀',
    });
    this._right = el('button', {
      class: 'touch-btn touch-btn-right',
      type: 'button',
      tabindex: '-1',
      'aria-label': 'Andar para a direita',
      text: '▶',
    });
    this._jump = el('button', {
      class: 'touch-btn touch-btn-jump',
      type: 'button',
      tabindex: '-1',
      'aria-label': 'Pular',
      text: '⤒',
    });

    this._dpad = el('div', { class: 'touch-controls-dpad' }, [this._left, this._right]);

    /** Elements + semantic actions, ready to hand to a TouchAdapter. */
    this.buttons = [
      { element: this._left, action: Actions.MOVE_LEFT },
      { element: this._right, action: Actions.MOVE_RIGHT },
      { element: this._jump, action: Actions.JUMP },
    ];
  }

  /** Mount the buttons and make them visible. */
  show() {
    clear(this._root);
    this._root.append(this._dpad, this._jump);
  }

  /** Unmount the buttons (they keep listening; TouchAdapter still owns that). */
  hide() {
    clear(this._root);
  }
}
