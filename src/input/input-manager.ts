import { Actions } from './actions.js';
import type { InputAdapter } from './input-adapter.js';

/**
 * Facade the gameplay layer talks to. It hides *which* adapter is active and
 * exposes two intents:
 *
 *   - `isActionHeld(action)`     -> continuous state (movement)
 *   - `consumePressed(action)`   -> one-shot edge, cleared once read (jump)
 *
 * Gameplay never sees key codes. Swapping the keyboard for an ESP32 adapter is
 * `setAdapter(new Esp32Adapter(...))` — no gameplay change (Open/Closed).
 */
export class InputManager {
  /** actions currently held down */
  private _held = new Set<string>();
  /** one-shot actions awaiting a read */
  private _pressed = new Set<string>();
  private _adapter: InputAdapter | null = null;

  constructor() {
    // Bound so it can be passed straight to an adapter's constructor.
    this.handleAction = this.handleAction.bind(this);
  }

  /** Install (and attach) an input adapter, disposing the previous one. */
  setAdapter(adapter: InputAdapter): void {
    if (this._adapter) {
      this._adapter.dispose();
    }
    this._adapter = adapter;
    this.reset();
    adapter.attach();
  }

  /** Entry point used by adapters. Records the semantic action. */
  handleAction(action: string, { pressed, repeated = false }: { pressed: boolean; repeated?: boolean } = { pressed: false }): void {
    if (pressed) {
      // Held state covers every action, so callers can ask e.g. "is jump still
      // held?" to shorten a jump when the key is released early.
      this._held.add(action);
      // The one-shot edge ignores OS key-repeat: holding must not re-fire it.
      if (!repeated) {
        this._pressed.add(action);
      }
    } else {
      this._held.delete(action);
    }
  }

  isActionHeld(action: string): boolean {
    return this._held.has(action);
  }

  /** Horizontal intent: -1 left, 1 right, 0 none. Convenience for controllers. */
  getMoveAxis(): number {
    const left = this.isActionHeld(Actions.MOVE_LEFT) ? 1 : 0;
    const right = this.isActionHeld(Actions.MOVE_RIGHT) ? 1 : 0;
    return right - left;
  }

  /** Reads and clears a one-shot action. @returns true only on the frame it was pressed */
  consumePressed(action: string): boolean {
    if (!this._pressed.has(action)) return false;
    this._pressed.delete(action);
    return true;
  }

  /** Clears all recorded state (on adapter swap, pause, or blur). */
  reset(): void {
    this._held.clear();
    this._pressed.clear();
  }

  /**
   * Clears one-shot presses that were never read, so a stale press cannot leak
   * into a later frame. Call once at the end of each simulated step.
   */
  endFrame(): void {
    this._pressed.clear();
  }

  dispose(): void {
    if (this._adapter) {
      this._adapter.dispose();
      this._adapter = null;
    }
    this.reset();
  }
}
