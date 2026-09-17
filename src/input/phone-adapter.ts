import { InputAdapter, type OnAction } from './input-adapter.js';
import { Actions } from './actions.js';

const BUTTON_TO_ACTION: Record<string, string> = {
  jump: Actions.JUMP,
};

/**
 * Transport contract this adapter needs — deliberately minimal so any
 * WebSocket wrapper (see net/signaling-socket.ts) can satisfy it. Kept here,
 * not in net/, so this file stays importable and testable with a fake
 * transport without pulling in socket.io-client (see phone-adapter.test.js).
 */
export interface PhoneTransport {
  connect(): void;
  disconnect(): void;
  onMessage(handler: (payload: { button: string; pressed: boolean }) => void): void;
}

interface PhoneAdapterOptions {
  transport: PhoneTransport;
}

/**
 * Same InputAdapter contract as KeyboardAdapter/TouchAdapter — only
 * translates, never decides game rules. The physical event here is a
 * WebSocket message forwarded by the signaling server, originating from a
 * phone's accelerometer-based jump detector (see docs/12-controle-por-celular.md).
 */
export class PhoneAdapter extends InputAdapter {
  private _transport: PhoneTransport;

  constructor(onAction: OnAction, { transport }: PhoneAdapterOptions) {
    super(onAction);
    this._transport = transport;
  }

  override attach(): void {
    this._transport.onMessage(({ button, pressed }) => this._handle({ button, pressed }));
    this._transport.connect();
  }

  override detach(): void {
    this._transport.disconnect();
  }

  private _handle({ button, pressed }: { button: string; pressed: boolean }): void {
    const action = BUTTON_TO_ACTION[button];
    if (!action) return;
    this.onAction(action, { pressed, repeated: false });
  }
}
