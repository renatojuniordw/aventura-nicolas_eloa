import { clear, el } from './dom.js';
import { Actions } from '../input/actions.js';
import type { TouchLayout } from '../persistence/touch-layout-store.js';

interface TouchControlsOptions {
  root: HTMLElement;
}

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
 *
 * Deliberately NOT a React component: `main.ts` builds one `TouchAdapter`
 * whose listeners are attached to these specific button elements once, for
 * the whole session (`show()`/`hide()` are called on every scene
 * enter/exit). A React-rendered version would create fresh DOM elements on
 * every mount, silently orphaning the adapter's listeners on the old ones
 * after the first re-render. Building these three stable buttons once with
 * the same `el()` helper the rest of the codebase used before the React
 * migration avoids that class of bug entirely.
 */
export class TouchControls {
  buttons: { element: HTMLElement; action: string }[];

  private _root: HTMLElement;
  private _left: HTMLElement;
  private _right: HTMLElement;
  private _jump: HTMLElement;
  private _dpad: HTMLElement;
  /** A layout that arrived mid-gesture, applied once no finger is down. */
  private _pendingLayout: TouchLayout | null = null;

  constructor({ root }: TouchControlsOptions) {
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
  show(): void {
    clear(this._root);
    this._root.append(this._dpad, this._jump);
  }

  /** Unmount the buttons (they keep listening; TouchAdapter still owns that). */
  hide(): void {
    clear(this._root);
    this.clearHeld();
    this.setHints([]);
  }

  /**
   * Shows whether an action is held right now. Driven by TouchAdapter's own
   * finger tracking (wired in main.ts), not by `:active`, so holding a
   * direction and tapping jump shows both, and lifting one finger never
   * clears the other. Purely visual: the hitbox never moves or shrinks.
   * No `aria-pressed` — these are momentary buttons, not toggles.
   */
  setHeld(action: string, held: boolean): void {
    for (const button of this.buttons) {
      if (button.action === action) button.element.classList.toggle('is-held', held);
    }
    if (!held) this._flushLayout();
  }

  /** Drops every held look at once (pause, rotation, leaving the level). */
  clearHeld(): void {
    for (const button of this.buttons) button.element.classList.remove('is-held');
    this._flushLayout();
  }

  /** Points at the buttons a practice step teaches (a visual cue only). */
  setHints(actions: readonly string[]): void {
    for (const button of this.buttons) button.element.classList.toggle('is-hinted', actions.includes(button.action));
  }

  /**
   * Applies a size/side/edge preset (docs/18 §7) through data attributes on
   * the root — the same button elements stay wired to the TouchAdapter. Never
   * moves a button under a finger: during a gesture the change waits for the
   * last finger to lift.
   */
  applyLayout(layout: TouchLayout): void {
    this._pendingLayout = layout;
    this._flushLayout();
  }

  private _flushLayout(): void {
    const layout = this._pendingLayout;
    if (!layout || this.buttons.some(({ element }) => element.classList.contains('is-held'))) return;
    this._pendingLayout = null;
    this._root.dataset.touchSize = layout.size;
    this._root.dataset.jumpSide = layout.jumpSide;
    this._root.dataset.touchInset = layout.edgeInset;
  }
}
