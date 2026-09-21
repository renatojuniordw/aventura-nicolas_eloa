import { Events, type EventBus } from '../core/event-bus.js';
import type { InputManager } from '../input/input-manager.js';
import { CompositeAdapter } from '../input/composite-adapter.js';
import { AutoRunAdapter } from '../input/auto-run-adapter.js';
import { PhoneAdapter } from '../input/phone-adapter.js';
import {
  startPhoneControlSession,
  type PhoneControlCallbacks,
  type PhoneControlHandle,
} from './phone-control-session.js';

/**
 * Phone-control mode (docs/12-controle-por-celular.md): once the phone pairs,
 * the keyboard/touch composite is replaced by AutoRun+Phone — production
 * guidance is to never mix them, since InputManager's "held" state is one
 * shared boolean per action (see auto-run-adapter.ts), not per source.
 *
 * `phone-control-session.ts` only owns the socket; this class owns everything
 * gameplay-facing: swapping the input adapter in and out, and pausing (reusing
 * the existing blur-pause path) if the phone drops mid session so auto-run
 * never runs the character into an obstacle unwatched.
 */
export class PhoneControlCoordinator {
  private _handle: PhoneControlHandle | null = null;
  private _active = false;
  private _input: InputManager;
  private _bus: EventBus;
  private _restoreDefaultInput: () => void;
  private _startSession: typeof startPhoneControlSession;

  constructor({
    input,
    bus,
    restoreDefaultInput,
    startSession = startPhoneControlSession,
  }: {
    input: InputManager;
    bus: EventBus;
    /** Re-attaches the keyboard/touch adapters once phone control ends. */
    restoreDefaultInput: () => void;
    startSession?: typeof startPhoneControlSession;
  }) {
    this._input = input;
    this._bus = bus;
    this._restoreDefaultInput = restoreDefaultInput;
    this._startSession = startSession;
  }

  /** True while the phone is paired and driving the game. */
  get isActive(): boolean {
    return this._active;
  }

  start(callbacks: PhoneControlCallbacks): {
    session: string;
    pairingUrl: string;
    measureLatency(): Promise<number | null>;
  } {
    this.stop();
    const handle = this._startSession({
      onPaired: () => {
        if (!this._active && this._handle) {
          this._active = true;
          this._input.setAdapter(
            new CompositeAdapter(this._input.handleAction, [
              new AutoRunAdapter(this._input.handleAction),
              new PhoneAdapter(this._input.handleAction, { transport: this._handle.transport }),
            ]),
          );
        }
        callbacks.onPaired();
      },
      onDisconnected: () => {
        if (this._active) this._bus.emit(Events.APP_BLURRED);
        callbacks.onDisconnected();
      },
      onError: callbacks.onError,
    });
    this._handle = handle;
    return {
      session: handle.session,
      pairingUrl: handle.pairingUrl,
      measureLatency: () => handle.measureLatency(),
    };
  }

  stop(): void {
    this._handle?.stop();
    this._handle = null;
    if (this._active) {
      this._active = false;
      this._restoreDefaultInput();
    }
  }
}
