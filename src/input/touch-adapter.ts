import { InputAdapter, type OnAction } from './input-adapter.js';

interface ButtonBinding {
  element: HTMLElement;
  action: string;
}

interface TouchAdapterOptions {
  buttons?: ButtonBinding[];
}

interface HandlerEntry {
  element: HTMLElement;
  action: string;
  onDown: (event: PointerEvent) => void;
  onUp: (event: PointerEvent) => void;
}

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
  private _buttons: ButtonBinding[];
  private _attached = false;
  private _handlers: HandlerEntry[];

  constructor(onAction: OnAction, { buttons }: TouchAdapterOptions = {}) {
    super(onAction);
    this._buttons = buttons ?? [];
    // One bound handler per button, closed over its action, so detach() can
    // remove the exact same function reference it added.
    this._handlers = this._buttons.map(({ element, action }) => ({
      element,
      action,
      onDown: (event: PointerEvent) => this._handleDown(event, action),
      onUp: (event: PointerEvent) => this._handleUp(event, action),
    }));
  }

  override attach(): void {
    if (this._attached) return;
    for (const { element, onDown, onUp } of this._handlers) {
      element.addEventListener('pointerdown', onDown as EventListener);
      element.addEventListener('pointerup', onUp as EventListener);
      element.addEventListener('pointercancel', onUp as EventListener);
      // A finger sliding off the button must release it too, otherwise the
      // action would stay "held" forever.
      element.addEventListener('pointerleave', onUp as EventListener);
    }
    this._attached = true;
  }

  override detach(): void {
    if (!this._attached) return;
    for (const { element, onDown, onUp } of this._handlers) {
      element.removeEventListener('pointerdown', onDown as EventListener);
      element.removeEventListener('pointerup', onUp as EventListener);
      element.removeEventListener('pointercancel', onUp as EventListener);
      element.removeEventListener('pointerleave', onUp as EventListener);
    }
    this._attached = false;
  }

  private _handleDown(event: PointerEvent, action: string): void {
    // Prevent the synthetic mouse events / scrolling / text selection a
    // browser would otherwise fire for the same touch.
    event.preventDefault();
    const target = event.target as (EventTarget & { setPointerCapture?: (id: number) => void }) | null;
    if (typeof target?.setPointerCapture === 'function' && event.pointerId !== undefined) {
      target.setPointerCapture(event.pointerId);
    }
    this.onAction(action, { pressed: true, repeated: false });
  }

  private _handleUp(event: PointerEvent, action: string): void {
    event.preventDefault();
    this.onAction(action, { pressed: false, repeated: false });
  }
}
