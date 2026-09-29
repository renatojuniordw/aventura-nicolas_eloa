import {
  SignalingSocket,
  type DiagnosticSink,
  type JoinState,
  type PeerHealth,
  type RoomSnapshot,
} from './signaling-socket.js';
import { ActionFilter } from './action-filter.js';
import type { PhoneTransport } from '../input/phone-adapter.js';

/** Everything the TV knows about the link, as plain data for the coordinator to judge. */
export interface ViewerLink {
  state: JoinState;
  /** The TV's own socket is connected AND its room confirmed. */
  joined: boolean;
  controllerPresent: boolean;
  /** The current phone connection, as numbered by the server. Health from any other one is ignored. */
  generation: number;
  /** A phone joined this session at least once. */
  everPaired: boolean;
  /** Last beacon from the phone, timed with this device's clock. */
  lastHealth: (PeerHealth & { receivedAt: number }) | null;
  /** When the current phone connection began (this device's clock), to give it time for its first beacon. */
  controllerSince: number | null;
  closeReason: string | null;
  lastError: string | null;
}

interface ViewerTransportOptions {
  url?: string;
  socket?: SignalingSocket;
  now?: () => number;
  onDiagnostic?: DiagnosticSink;
}

/**
 * TV/viewer side of the signaling socket and the concrete `PhoneTransport`
 * PhoneAdapter reads from. Tracks presence and health from the server's
 * snapshots and filters stale/duplicate commands before any reaches gameplay.
 */
export class PhoneViewerTransport implements PhoneTransport {
  private _socket: SignalingSocket;
  private _now: () => number;
  private _onDiagnostic: DiagnosticSink | undefined;
  private _filter = new ActionFilter();
  private _controllerPresent = false;
  private _everPaired = false;
  private _controllerSince: number | null = null;
  private _lastHealth: ViewerLink['lastHealth'] = null;
  private _listeners = new Set<(link: ViewerLink) => void>();

  constructor(session: string, { url, socket, now = () => performance.now(), onDiagnostic }: ViewerTransportOptions = {}) {
    this._socket = socket ?? new SignalingSocket({ url, role: 'viewer', session, onDiagnostic });
    this._now = now;
    this._onDiagnostic = onDiagnostic;

    const applySnapshot = (snapshot: RoomSnapshot) => {
      this._observeGeneration(snapshot.generation);
      this._setController(snapshot.peers.controller);
      this._changed();
    };
    this._socket.onJoined(applySnapshot);
    this._socket.onPresence(applySnapshot);
    this._socket.onPeerLeft(({ role }) => {
      if (role !== 'controller') return;
      this._setController(false);
      this._changed();
    });
    this._socket.onPeerHealth((health) => {
      if (!Number.isSafeInteger(health.generation) || health.generation < this._filter.generation) return;
      // A beacon can overtake the presence snapshot announcing its connection.
      this._observeGeneration(health.generation);
      const receivedAt = this._now();
      this._filter.observeClock(health.generation, health.sentAt, receivedAt);
      this._lastHealth = { ...health, receivedAt };
      this._changed();
    });
    this._socket.onStateChange((state) => {
      // Our own drop: the phone's presence is unknown until the next snapshot.
      if (state !== 'joined') this._setController(false);
      this._changed();
    });
    this._socket.onJoinError(() => this._changed());
  }

  get link(): ViewerLink {
    return {
      state: this._socket.state,
      joined: this._socket.joined,
      controllerPresent: this._controllerPresent,
      generation: this._filter.generation,
      everPaired: this._everPaired,
      lastHealth: this._lastHealth,
      controllerSince: this._controllerSince,
      closeReason: this._socket.closeReason,
      lastError: this._socket.lastError,
    };
  }

  connect(): void {
    this._socket.connect();
  }

  /** Explicit end of the session: the phone is told immediately. */
  leave(): void {
    this._socket.leave();
  }

  dispose(): void {
    this._listeners.clear();
    this._socket.dispose();
  }

  /** Fresh, not-yet-seen, not-too-late commands from the current phone connection only. */
  onMessage(handler: (payload: { button: string; pressed: boolean }) => void): () => void {
    return this._socket.onAction((action) => {
      if (!this._filter.accept(action, this._now())) {
        this._onDiagnostic?.('action-dropped', { generation: action.generation ?? null, seq: action.seq ?? null });
        return;
      }
      handler({ button: action.button, pressed: action.pressed });
    });
  }

  /**
   * The match starts accepting commands now (this device's clock): anything
   * the phone sent earlier — e.g. a jump made on the pause screen — is dropped.
   */
  armAt(now: number): void {
    this._filter.armAt(now);
  }

  onLinkChange(handler: (link: ViewerLink) => void): () => void {
    this._listeners.add(handler);
    return () => this._listeners.delete(handler);
  }

  /** Round-trip time to the signaling server, in ms, or null if unreachable — shown on the pairing screen. */
  measureLatency(): Promise<number | null> {
    return this._socket.measureLatency();
  }

  /** A new phone connection: nothing the previous one reported applies to it. */
  private _observeGeneration(generation: number): void {
    if (!this._filter.observeGeneration(generation)) return;
    this._lastHealth = null;
    if (this._controllerPresent) this._controllerSince = this._now();
  }

  private _setController(present: boolean): void {
    if (present === this._controllerPresent) return;
    this._controllerPresent = present;
    this._controllerSince = present ? this._now() : null;
    // Health from a previous presence says nothing about the new one.
    this._lastHealth = null;
    if (present) this._everPaired = true;
  }

  private _changed(): void {
    const link = this.link;
    for (const listener of [...this._listeners]) listener(link);
  }
}
