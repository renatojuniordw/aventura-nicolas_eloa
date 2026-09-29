import { InputAdapter, type OnAction } from './input-adapter.js';
import { Actions } from './actions.js';
import { DEBUG } from '../core/debug-flag.js';

const BUTTON_TO_ACTION: Record<string, string> = {
  jump: Actions.JUMP,
};

/**
 * Transport contract this adapter needs — deliberately minimal so any
 * WebSocket wrapper (see net/phone-viewer-transport.ts) can satisfy it. Kept
 * here, not in net/, so this file stays importable and testable with a fake
 * transport without pulling in socket.io-client (see phone-adapter.test.js).
 *
 * The adapter only listens: the session (connect, leave) has a single owner,
 * the PhoneControlCoordinator, so swapping input sources — e.g. going back to
 * the menu — never tears the pairing down (docs/19 §4 P0.5/P1.2).
 */
export interface PhoneTransport {
  /** @returns unsubscribe */
  onMessage(handler: (payload: { button: string; pressed: boolean }) => void): () => void;
}

interface PhoneAdapterOptions {
  transport: PhoneTransport;
  /** Commands are dropped while this says no (link not operational, or not in a match). */
  isArmed?: () => boolean;
}

/**
 * Same InputAdapter contract as KeyboardAdapter/TouchAdapter — only
 * translates, never decides game rules. The physical event here is a
 * WebSocket message forwarded by the signaling server, originating from a
 * phone's accelerometer-based jump detector (see docs/12-controle-por-celular.md).
 *
 * The phone only ever sends `pressed: true` pulses; the held state they leave
 * is cleared by InputManager.reset() on every pause and adapter swap.
 */
export class PhoneAdapter extends InputAdapter {
  private _transport: PhoneTransport;
  private _isArmed: () => boolean;
  private _unsubscribe: (() => void) | null = null;

  constructor(onAction: OnAction, { transport, isArmed = () => true }: PhoneAdapterOptions) {
    super(onAction);
    this._transport = transport;
    this._isArmed = isArmed;
  }

  override attach(): void {
    if (this._unsubscribe) return;
    this._unsubscribe = this._transport.onMessage(({ button, pressed }) => this._handle({ button, pressed }));
  }

  override detach(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  private _handle({ button, pressed }: { button: string; pressed: boolean }): void {
    if (DEBUG.enabled) console.log(`[phone-adapter] action recebida button=${button} pressed=${pressed}`);
    if (!this._isArmed()) return;
    const action = BUTTON_TO_ACTION[button];
    if (!action) return;
    this.onAction(action, { pressed, repeated: false });
  }
}
