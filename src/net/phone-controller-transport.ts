import { SignalingSocket } from './signaling-socket.js';

/**
 * Phone/controller side of the signaling socket, used by `src/controle`.
 * Mirrors `PhoneViewerTransport` but sends instead of receives.
 */
export class PhoneControllerTransport {
  private _socket: SignalingSocket;

  constructor(session: string, url?: string) {
    this._socket = new SignalingSocket({ url, role: 'controller', session });
  }

  connect(): void {
    this._socket.connect();
  }

  disconnect(): void {
    this._socket.disconnect();
  }

  sendJump(): void {
    this._socket.sendAction({ button: 'jump', pressed: true });
  }

  onConnectionChange(handler: (connected: boolean) => void): void {
    this._socket.onConnectionChange(handler);
  }

  onJoinError(handler: (payload: { error: string }) => void): void {
    this._socket.onJoinError(handler);
  }

  onRoomClosed(handler: () => void): void {
    this._socket.onRoomClosed(handler);
  }
}
