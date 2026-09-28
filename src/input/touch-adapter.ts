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
  onLeave: (event: PointerEvent) => void;
}

/**
 * Touch/pointer implementation of InputAdapter, driven by on-screen virtual
 * buttons (see ui/touch-controls.js) instead of hardware events.
 *
 * Uses Pointer Events (not touch events) so the same buttons also work with
 * mouse or pen input — useful for a convertible laptop with a touch screen,
 * and for exercising this adapter in tests without simulating real touches.
 *
 * Multitouch: every active finger is tracked by `pointerId`. An action is
 * pressed by its first finger and released only when its last finger lifts,
 * so holding "right" while tapping "jump" with another finger never drops the
 * movement, and two fingers on the same button release it only once both go.
 *
 * Drag-out policy: a captured finger keeps its button held even if it drifts
 * past the visual edge (a small thumb slide must not stop the player); it is
 * released on lift, cancel or lost capture. Without capture support (some
 * mouse/pen setups), leaving the button releases it instead.
 *
 * This file is intentionally logic-free, same rule as KeyboardAdapter: it
 * only translates a pointer on a button into a semantic action.
 */
export class TouchAdapter extends InputAdapter {
  private _buttons: ButtonBinding[];
  private _attached = false;
  private _handlers: HandlerEntry[];
  /** pointerId → action it is currently holding. */
  private _pointers = new Map<number, string>();

  constructor(onAction: OnAction, { buttons }: TouchAdapterOptions = {}) {
    super(onAction);
    this._buttons = buttons ?? [];
    // One bound handler per button, closed over its action, so detach() can
    // remove the exact same function reference it added.
    this._handlers = this._buttons.map(({ element, action }) => ({
      element,
      action,
      onDown: (event: PointerEvent) => this._handleDown(event, element, action),
      onUp: (event: PointerEvent) => this._handleUp(event),
      onLeave: (event: PointerEvent) => {
        if (!element.hasPointerCapture?.(event.pointerId)) this._handleUp(event);
      },
    }));
  }

  override attach(): void {
    if (this._attached) return;
    for (const { element, onDown, onUp, onLeave } of this._handlers) {
      element.addEventListener('pointerdown', onDown as EventListener);
      element.addEventListener('pointerup', onUp as EventListener);
      element.addEventListener('pointercancel', onUp as EventListener);
      element.addEventListener('lostpointercapture', onUp as EventListener);
      element.addEventListener('pointerleave', onLeave as EventListener);
    }
    this._attached = true;
  }

  override detach(): void {
    if (!this._attached) return;
    for (const { element, onDown, onUp, onLeave } of this._handlers) {
      element.removeEventListener('pointerdown', onDown as EventListener);
      element.removeEventListener('pointerup', onUp as EventListener);
      element.removeEventListener('pointercancel', onUp as EventListener);
      element.removeEventListener('lostpointercapture', onUp as EventListener);
      element.removeEventListener('pointerleave', onLeave as EventListener);
    }
    this.releaseHeld();
    this._attached = false;
  }

  /**
   * Forgets every tracked finger, releasing what they held. Called when the
   * game resets input (pause, blur, rotation), so a finger that was down
   * before cannot later "release" a fresh press, and a new touch on the same
   * button is seen as a new press.
   */
  override releaseHeld(): void {
    const held = new Set(this._pointers.values());
    this._pointers.clear();
    for (const action of held) this.onAction(action, { pressed: false, repeated: false });
  }

  private _handleDown(event: PointerEvent, element: HTMLElement, action: string): void {
    // Prevent the synthetic mouse events / scrolling / text selection a
    // browser would otherwise fire for the same touch.
    event.preventDefault();
    const id = event.pointerId ?? 0;
    // Capture on the button that owns the listener, never on an inner node.
    try {
      element.setPointerCapture?.(id);
    } catch {
      /* pointer already gone (InvalidPointerId) */
    }
    const previous = this._pointers.get(id);
    if (previous === action) return;
    if (previous !== undefined) this._release(id);
    const alreadyHeld = this._isHeld(action);
    this._pointers.set(id, action);
    if (!alreadyHeld) this.onAction(action, { pressed: true, repeated: false });
  }

  private _handleUp(event: PointerEvent): void {
    if (event.cancelable) event.preventDefault();
    this._release(event.pointerId ?? 0);
  }

  private _release(id: number): void {
    const action = this._pointers.get(id);
    if (action === undefined) return;
    this._pointers.delete(id);
    if (!this._isHeld(action)) this.onAction(action, { pressed: false, repeated: false });
  }

  private _isHeld(action: string): boolean {
    for (const held of this._pointers.values()) if (held === action) return true;
    return false;
  }
}
