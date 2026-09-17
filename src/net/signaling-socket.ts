import { io, type Socket } from 'socket.io-client';

export type SignalingRole = 'viewer' | 'controller';

export interface ActionPayload {
  button: string;
  pressed: boolean;
}

/** The narrow slice of socket.io-client's Socket this wrapper actually uses — small enough to fake in tests. */
export interface SignalingIoSocket {
  connected: boolean;
  connect(): void;
  disconnect(): void;
  emit(event: string, payload?: unknown): void;
  on(event: string, handler: (...args: never[]) => void): void;
}

interface SignalingSocketOptions {
  /** Same-origin by default: the reverse proxy routes /socket.io/ to the signaling container (see docker/nginx-vps.conf). */
  url?: string;
  role: SignalingRole;
  session: string;
  /** Injectable for tests — defaults to a real socket.io-client connection. */
  createSocket?: (url: string) => SignalingIoSocket;
}

function defaultCreateSocket(url: string): SignalingIoSocket {
  return io(url, { autoConnect: false, transports: ['websocket', 'polling'] }) as Socket;
}

/**
 * Thin wrapper over socket.io-client (docs/12-controle-por-celular.md §3):
 * joins the room on connect, re-joins automatically on every reconnect
 * (socket.io's own reconnection handles WiFi drops / backgrounded tabs), and
 * exposes the small, typed surface both the TV (viewer) and the phone
 * (controller) sides need. Neither PhoneAdapter nor the /controle page talk
 * to socket.io directly — this is the only file that does.
 */
export class SignalingSocket {
  private _socket: SignalingIoSocket;
  private _role: SignalingRole;
  private _session: string;

  constructor({ url = '/', role, session, createSocket = defaultCreateSocket }: SignalingSocketOptions) {
    this._role = role;
    this._session = session;
    this._socket = createSocket(url);
    this._socket.on('connect', () => this._join());
  }

  connect(): void {
    this._socket.connect();
  }

  disconnect(): void {
    this._socket.disconnect();
  }

  get connected(): boolean {
    return this._socket.connected;
  }

  sendAction(payload: ActionPayload): void {
    this._socket.emit('action', payload);
  }

  onAction(handler: (payload: ActionPayload) => void): void {
    this._socket.on('action', handler);
  }

  onPeerJoined(handler: () => void): void {
    this._socket.on('peer-joined', handler);
  }

  onPeerLeft(handler: () => void): void {
    this._socket.on('peer-left', handler);
  }

  onRoomClosed(handler: () => void): void {
    this._socket.on('room-closed', handler);
  }

  onJoinError(handler: (payload: { error: string }) => void): void {
    this._socket.on('join-error', handler);
  }

  /** True on the transport's own connect/reconnect, false on disconnect. */
  onConnectionChange(handler: (connected: boolean) => void): void {
    this._socket.on('connect', () => handler(true));
    this._socket.on('disconnect', () => handler(false));
  }

  private _join(): void {
    this._socket.emit('join', { role: this._role, session: this._session });
  }
}
