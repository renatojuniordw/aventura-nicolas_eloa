import { InputAdapter } from './input-adapter.js';

/**
 * Touch/pointer implementation of InputAdapter, driven by on-screen virtual
 * buttons (see ui/touch-controls.js) instead of hardware events.
 *
 * Uses Pointer Events (not touch events) so the same buttons also work with
 * mouse or pen input — useful for a convertible laptop with a touch screen,
 * and for exercising this adapter in tests without simulating real touches.
 *
 * This file is intentionally logic-free, same rule as KeyboardAdapter: it
 * only translates a pointer on a button into a semantic action.
 */
export class TouchAdapter extends InputAdapter {
  /**
   * @param {(action: string, meta: { pressed: boolean, repeated: boolean }) => void} onAction
   * @param {{ buttons: Array<{ element: HTMLElement, action: string }> }} options
   */
  constructor(onAction, { buttons } = {}) {
    super(onAction);
    this._buttons = buttons ?? [];
    this._attached = false;
    // One bound handler per button, closed over its action, so detach() can
    // remove the exact same function reference it added.
    this._handlers = this._buttons.map(({ element, action }) => ({
      element,
      action,
      onDown: (event) => this._handleDown(event, action),
      onUp: (event) => this._handleUp(event, action),
    }));
  }

  attach() {
    if (this._attached) return;
    for (const { element, onDown, onUp } of this._handlers) {
      element.addEventListener('pointerdown', onDown);
      element.addEventListener('pointerup', onUp);
      element.addEventListener('pointercancel', onUp);
      // A finger sliding off the button must release it too, otherwise the
      // action would stay "held" forever.
      element.addEventListener('pointerleave', onUp);
    }
    this._attached = true;
  }

  detach() {
    if (!this._attached) return;
    for (const { element, onDown, onUp } of this._handlers) {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('pointerleave', onUp);
    }
    this._attached = false;
  }

  _handleDown(event, action) {
    // Prevent the synthetic mouse events / scrolling / text selection a
    // browser would otherwise fire for the same touch.
    event.preventDefault();
    if (typeof event.target?.setPointerCapture === 'function' && event.pointerId !== undefined) {
      event.target.setPointerCapture(event.pointerId);
    }
    this.onAction(action, { pressed: true, repeated: false });
  }

  _handleUp(event, action) {
    event.preventDefault();
    this.onAction(action, { pressed: false, repeated: false });
  }
}
