import { SignalingSocket } from './signaling-socket.js';
import type { PhoneTransport } from '../input/phone-adapter.js';

/**
 * The concrete `PhoneTransport` PhoneAdapter is wired with in production
 * (main.ts) — TV/viewer side of the signaling socket. Also exposes pairing
 * and disconnect signals the phone-pairing screen and the auto-pause-on-drop
 * behavior need, which are outside PhoneAdapter's own minimal contract.
 */
export class PhoneViewerTransport implements PhoneTransport {
  private _socket: SignalingSocket;

  constructor(session: string, url?: string) {
    this._socket = new SignalingSocket({ url, role: 'viewer', session });
  }

  connect(): void {
    this._socket.connect();
  }

  disconnect(): void {
    this._socket.disconnect();
  }

  onMessage(handler: (payload: { button: string; pressed: boolean }) => void): void {
    this._socket.onAction(handler);
  }

  /** Fires once the phone has paired (first join, or a reconnect after a drop). */
  onPaired(handler: () => void): void {
    this._socket.onPeerJoined(handler);
  }

  /** Fires when the paired phone disconnects — WiFi, background, screen lock. */
  onUnpaired(handler: () => void): void {
    this._socket.onPeerLeft(handler);
  }

  /** Fires when the server rejects a phone's join attempt for this session. */
  onJoinError(handler: (payload: { error: string }) => void): void {
    this._socket.onJoinError(handler);
  }

  /** Round-trip time to the signaling server, in ms, or null if unreachable — shown on the pairing screen. */
  measureLatency(): Promise<number | null> {
    return this._socket.measureLatency();
  }
}
