import { clear, el } from './dom.js';

/**
 * Persistent DOM controls drawn on top of the canvas but below the modal
 * overlay layer, e.g. a visible pause button. Unlike MenuOverlay, controls
 * here stay mounted for the lifetime of a scene rather than being replaced
 * per screen.
 */
export class HudControls {
  /** @param {{ root: HTMLElement }} options */
  constructor({ root }) {
    this._root = root;
  }

  showPauseButton({ onPause }) {
    clear(this._root);
    this._root.append(
      el('button', {
        class: 'pause-btn',
        type: 'button',
        tabindex: '-1',
        'aria-label': 'Pausar',
        text: '⏸',
        onClick: onPause,
      }),
    );
  }

  hidePauseButton() {
    clear(this._root);
  }
}
