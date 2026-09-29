import {
  SignalingSocket,
  type DiagnosticSink,
  type HealthPayload,
  type JoinState,
  type RoomSnapshot,
} from './signaling-socket.js';

/**
 * Phone/controller side of the signaling socket, used by `src/controle`.
 * Mirrors `PhoneViewerTransport` but sends instead of receives, and tracks
 * whether the game (viewer) is currently in the room.
 */
export class PhoneControllerTransport {
  private _socket: SignalingSocket;
  private _viewerPresent = false;

  constructor(session: string, { url, socket, onDiagnostic }: { url?: string; socket?: SignalingSocket; onDiagnostic?: DiagnosticSink } = {}) {
    this._socket = socket ?? new SignalingSocket({ url, role: 'controller', session, onDiagnostic });
    const apply = (snapshot: RoomSnapshot) => {
      this._viewerPresent = snapshot.peers.viewer;
    };
    this._socket.onJoined(apply);
    this._socket.onPresence(apply);
    this._socket.onPeerLeft(({ role }) => {
      if (role === 'viewer') this._viewerPresent = false;
    });
    this._socket.onStateChange((state) => {
      if (state !== 'joined') this._viewerPresent = false;
    });
  }

  get state(): JoinState {
    return this._socket.state;
  }

  /** Room confirmed by the server on the current connection. */
  get joined(): boolean {
    return this._socket.joined;
  }

  get connected(): boolean {
    return this._socket.connected;
  }

  /** The game's screen is in the room right now. */
  get viewerPresent(): boolean {
    return this._socket.joined && this._viewerPresent;
  }

  get lastError(): string | null {
    return this._socket.lastError;
  }

  get closeReason(): string | null {
    return this._socket.closeReason;
  }

  /** Idempotent: connects, or re-sends the join when already connected. */
  connect(): void {
    this._socket.connect();
  }

  leave(): void {
    this._socket.leave();
  }

  dispose(): void {
    this._socket.dispose();
  }

  /** @returns whether the jump left the phone (dropped while not confirmed — never queued). */
  sendJump(): boolean {
    return this._socket.sendAction({ button: 'jump', pressed: true });
  }

  sendHealth(health: HealthPayload): boolean {
    return this._socket.sendHealth(health);
  }

  /** Any change worth re-rendering the status for (state, presence, errors). */
  onChange(handler: () => void): () => void {
    const offs = [
      this._socket.onStateChange(() => handler()),
      this._socket.onJoined(() => handler()),
      this._socket.onPresence(() => handler()),
      this._socket.onPeerLeft(() => handler()),
      this._socket.onJoinError(() => handler()),
      this._socket.onConnectionChange(() => handler()),
    ];
    return () => offs.forEach((off) => off());
  }
}
