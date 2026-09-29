import { io } from 'socket.io-client';

export type SignalingRole = 'viewer' | 'controller';

/** Must match signaling/src/room-manager.js — a mismatch is refused by the server. */
export const PROTOCOL_VERSION = 3;

export interface ActionPayload {
  button: string;
  pressed: boolean;
}

/**
 * What the viewer receives: the server stamps the controller generation and
 * relays the phone's own monotonic send time (`null` if missing), which only
 * means something relative to other sends of the same generation.
 */
export interface StampedAction extends ActionPayload {
  seq: number | null;
  sentAt?: number | null;
  generation: number;
}

export interface HealthPayload {
  sensor: 'ok' | 'stale' | 'none';
  visible: boolean;
}

export interface PeerHealth extends HealthPayload {
  sentAt?: number | null;
  generation: number;
}

/** The server's authoritative view of the room, sent on every join and presence change. */
export interface RoomSnapshot {
  protocol: number;
  role: SignalingRole;
  resumed: boolean;
  generation: number;
  peers: { viewer: boolean; controller: boolean };
}

/**
 * `joined` is the only state in which the room is confirmed. The last three
 * are terminal: the socket stops reconnecting and a new session is needed.
 */
export type JoinState =
  | 'idle'
  | 'connecting'
  | 'joining'
  | 'waiting-room'
  | 'joined'
  | 'rejected'
  | 'replaced'
  | 'closed';

/** The narrow slice of socket.io-client's Socket this wrapper actually uses — small enough to fake in tests. */
export interface SignalingIoSocket {
  connected: boolean;
  connect(): void;
  disconnect(): void;
  emit(event: string, ...args: unknown[]): void;
  on(event: string, handler: (...args: never[]) => void): void;
  off(event: string, handler: (...args: never[]) => void): void;
  /**
   * socket.io-client's offline queue, flushed on reconnect *before* the
   * `connect` event this wrapper joins on. Ephemeral packets are purged from
   * it on every drop (docs/19 §4 P0.5).
   */
  sendBuffer?: Array<{ data?: unknown[] }>;
}

/** Commands and beacons that must never be replayed after a reconnect. */
const EPHEMERAL_EVENTS: ReadonlySet<unknown> = new Set(['action', 'health', 'ping-check']);

/** Where the resume token lives between reloads of the same tab. */
export interface TokenStore {
  read(): string | null;
  write(token: string | null): void;
  /** The session is still in use: restart the token's validity window. */
  touch?(): void;
}

export type DiagnosticSink = (type: string, detail?: Record<string, string | number | boolean | null>) => void;

interface SignalingSocketOptions {
  /** Same-origin by default: the reverse proxy routes /socket.io/ to the signaling container (see docker/nginx-vps.conf). */
  url?: string;
  role: SignalingRole;
  session: string;
  /** Injectable for tests — defaults to a real socket.io-client connection. */
  createSocket?: (url: string) => SignalingIoSocket;
  tokenStore?: TokenStore;
  onDiagnostic?: DiagnosticSink;
  /** A join without an answer after this long is sent again. */
  joinTimeoutMs?: number;
  /** Backoff between join retries: base, doubled per attempt, capped, with jitter. */
  retryBaseMs?: number;
  retryMaxMs?: number;
  /** How long the phone keeps retrying `room-not-found` (the TV may be reconnecting or the server restarting). */
  waitForRoomMs?: number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (id: unknown) => void;
  now?: () => number;
  /** Monotonic clock stamped on every command/beacon as `sentAt` (docs/19 §4 P0.5). */
  monotonicNow?: () => number;
  random?: () => number;
}

/**
 * Validity of a saved token counted from the last moment the session was seen
 * in use, not from when it was issued: a 30-minute match keeps renewing it.
 * Longer than any server retention window (2/5/15 min), so the server — not
 * this copy — decides when a room is really gone.
 */
export const TOKEN_TTL_MS = 20 * 60 * 1000;
/** Renewals are rate-limited; the TTL is minutes, so seconds of slack are harmless. */
const TOKEN_TOUCH_INTERVAL_MS = 5000;
const LEAVE_ACK_TIMEOUT_MS = 1000;

/**
 * Resume token kept in the tab's sessionStorage, with an expiry counted from
 * the last `write`/`touch`. Never logged and never part of a diagnostic
 * report. Silently in-memory where storage is blocked (private mode,
 * sandboxed iframe).
 */
export function sessionTokenStore(role: SignalingRole, session: string, now: () => number = Date.now): TokenStore {
  const key = `aventura.phone-resume.${role}.${session}`;
  let memory: string | null = null;
  let touchedAt = -Infinity;
  const storage = (): Storage | null => {
    try {
      return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    read() {
      try {
        const raw = storage()?.getItem(key);
        if (!raw) return memory;
        const { token, savedAt } = JSON.parse(raw) as { token?: unknown; savedAt?: unknown };
        if (typeof token !== 'string' || typeof savedAt !== 'number' || now() - savedAt > TOKEN_TTL_MS) return null;
        return token;
      } catch {
        return memory;
      }
    },
    write(token) {
      memory = token;
      touchedAt = now();
      try {
        if (token) storage()?.setItem(key, JSON.stringify({ token, savedAt: touchedAt }));
        else storage()?.removeItem(key);
      } catch {
        // memory copy only
      }
    },
    touch() {
      if (!memory || now() - touchedAt < TOKEN_TOUCH_INTERVAL_MS) return;
      this.write(memory);
    },
  };
}

function defaultCreateSocket(url: string): SignalingIoSocket {
  // socket.io-client's real Socket type is far wider (typed per-event
  // overloads) than the narrow structural interface above needs — cast
  // through unknown rather than widen SignalingIoSocket to match it exactly.
  return io(url, { autoConnect: false, transports: ['websocket', 'polling'] }) as unknown as SignalingIoSocket;
}

type Listener<T> = (payload: T) => void;

class Channel<T> {
  private _listeners = new Set<Listener<T>>();
  on(listener: Listener<T>): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
  emit(payload: T): void {
    for (const listener of [...this._listeners]) listener(payload);
  }
  clear(): void {
    this._listeners.clear();
  }
}

const TERMINAL: ReadonlySet<JoinState> = new Set(['rejected', 'replaced', 'closed']);

/**
 * Wrapper over socket.io-client (docs/12 §3, docs/19 §4): the only file that
 * talks to socket.io. It separates "socket connected" from "room confirmed":
 *
 *  - every connect sends `join` (with the resume token when there is one) and
 *    waits for the server's `joined` snapshot; a join with no answer is sent
 *    again with backoff and jitter, without needing a new `connect`;
 *  - errors are classified, and a phone that arrives before the TV recreated
 *    its room keeps retrying for a bounded window;
 *  - movement commands and health beacons are only sent while joined, and
 *    any that socket.io queued in the instant before a drop is purged, so
 *    nothing from before a reconnect is replayed. (socket.io's `volatile`
 *    flag is not used: in 4.8 it also discards a packet whenever the previous
 *    one is still being written, which would lose back-to-back jumps.) The
 *    server also ignores commands from a socket that has not re-joined;
 *  - being replaced by a newer socket, or the room closing, is terminal.
 *
 * Every public `on*` returns its own unsubscribe; `dispose()` drops them all.
 */
export class SignalingSocket {
  private _socket: SignalingIoSocket;
  private _role: SignalingRole;
  private _session: string;
  private _tokens: TokenStore;
  private _diag: DiagnosticSink;
  private _joinTimeoutMs: number;
  private _retryBaseMs: number;
  private _retryMaxMs: number;
  private _waitForRoomMs: number;
  private _setTimeout: (fn: () => void, ms: number) => unknown;
  private _clearTimeout: (id: unknown) => void;
  private _now: () => number;
  private _monotonicNow: () => number;
  private _random: () => number;
  private _offPageHide: (() => void) | null = null;

  private _state: JoinState = 'idle';
  private _snapshot: RoomSnapshot | null = null;
  private _lastError: string | null = null;
  private _closeReason: string | null = null;
  private _attempts = 0;
  private _joinTimer: unknown = null;
  private _retryTimer: unknown = null;
  private _waitingSince: number | null = null;
  private _seq = 0;
  private _disposed = false;
  private _pendingLeave: (() => void) | null = null;
  private _socketHandlers: Array<[string, (...args: never[]) => void]> = [];

  private _stateChannel = new Channel<JoinState>();
  private _joinedChannel = new Channel<RoomSnapshot>();
  private _presenceChannel = new Channel<RoomSnapshot>();
  private _actionChannel = new Channel<StampedAction>();
  private _healthChannel = new Channel<PeerHealth>();
  private _peerLeftChannel = new Channel<{ role: SignalingRole; reason: string }>();
  private _errorChannel = new Channel<{ error: string }>();
  private _closedChannel = new Channel<{ reason: string }>();
  private _connectionChannel = new Channel<boolean>();

  constructor({
    url = '/',
    role,
    session,
    createSocket = defaultCreateSocket,
    tokenStore,
    onDiagnostic = () => {},
    joinTimeoutMs = 4000,
    retryBaseMs = 1000,
    retryMaxMs = 8000,
    waitForRoomMs = 60_000,
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
    clearTimeoutFn = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    now = () => Date.now(),
    monotonicNow = () => performance.now(),
    random = Math.random,
  }: SignalingSocketOptions) {
    this._role = role;
    this._session = session;
    this._tokens = tokenStore ?? sessionTokenStore(role, session);
    this._diag = onDiagnostic;
    this._joinTimeoutMs = joinTimeoutMs;
    this._retryBaseMs = retryBaseMs;
    this._retryMaxMs = retryMaxMs;
    this._waitForRoomMs = waitForRoomMs;
    this._setTimeout = setTimeoutFn;
    this._clearTimeout = clearTimeoutFn;
    this._now = now;
    this._monotonicNow = monotonicNow;
    this._random = random;
    this._socket = createSocket(url);

    // A reload is exactly when the token is needed: renew it on the way out.
    if (typeof window !== 'undefined') {
      const onPageHide = () => this._touchToken(true);
      window.addEventListener('pagehide', onPageHide);
      this._offPageHide = () => window.removeEventListener('pagehide', onPageHide);
    }

    this._listen('connect', () => {
      this._diag('socket-connect');
      this._connectionChannel.emit(true);
      this._join();
    });
    this._listen('disconnect', (reason: unknown) => {
      this._purgeEphemeral();
      this._diag('socket-disconnect', { reason: String(reason) });
      this._clearTimers();
      if (!TERMINAL.has(this._state)) this._setState('connecting');
      this._connectionChannel.emit(false);
    });
    this._listen('joined', (payload: unknown) => this._onJoined(payload));
    this._listen('join-error', (payload: unknown) => this._onJoinError(payload));
    this._listen('presence', (payload: unknown) => {
      const snapshot = payload as RoomSnapshot;
      if (!snapshot?.peers) return;
      this._snapshot = snapshot;
      this._touchToken();
      this._presenceChannel.emit(snapshot);
    });
    this._listen('peer-left', (payload: unknown) => {
      const { role: peerRole, reason } = (payload ?? {}) as { role?: SignalingRole; reason?: string };
      this._diag('peer-left', { role: peerRole ?? null, reason: reason ?? null });
      if (peerRole) this._peerLeftChannel.emit({ role: peerRole, reason: reason ?? 'dropped' });
    });
    this._listen('action', (payload: unknown) => {
      const action = payload as StampedAction;
      if (this._state !== 'joined' || typeof action?.button !== 'string') return;
      this._touchToken();
      this._actionChannel.emit(action);
    });
    this._listen('peer-health', (payload: unknown) => {
      const health = payload as PeerHealth;
      if (this._state !== 'joined' || !health) return;
      this._touchToken();
      this._healthChannel.emit(health);
    });
    this._listen('session-replaced', () => this._terminate('replaced', 'replaced'));
    this._listen('room-closed', (payload: unknown) => {
      const reason = ((payload ?? {}) as { reason?: string }).reason ?? 'ended';
      this._tokens.write(null);
      this._terminate('closed', reason);
    });
  }

  get state(): JoinState {
    return this._state;
  }

  get joined(): boolean {
    return this._state === 'joined' && this._socket.connected;
  }

  get connected(): boolean {
    return this._socket.connected;
  }

  get snapshot(): RoomSnapshot | null {
    return this._snapshot;
  }

  /** Last `join-error` code, cleared only by a confirmed join. */
  get lastError(): string | null {
    return this._lastError;
  }

  /** Why the session ended (`ended`, `expired`, `replaced`, or the rejecting error). */
  get closeReason(): string | null {
    return this._closeReason;
  }

  /** Opens the socket, or re-sends the join right away if it is already open. Idempotent. */
  connect(): void {
    if (this._disposed || TERMINAL.has(this._state)) return;
    if (this._socket.connected) {
      this.rejoin();
      return;
    }
    if (this._state === 'idle') this._setState('connecting');
    this._socket.connect();
  }

  /** Explicit retry: joins again now (resetting the backoff) without waiting for a new `connect`. */
  rejoin(): void {
    if (this._disposed || TERMINAL.has(this._state)) return;
    this._attempts = 0;
    this._clearTimers();
    if (this._socket.connected) this._join();
    else this._socket.connect();
  }

  /**
   * Explicit end of the session ("Desconectar"): the server tells the other
   * side at once. The socket closes only after the server acknowledged the
   * leave (or a short timeout): socket.io's server dispatches events on the
   * next tick and drops any that arrive together with a disconnect.
   */
  leave(): void {
    this._tokens.write(null);
    if (!this._socket.connected || TERMINAL.has(this._state)) {
      this._terminate('closed', 'left');
      return;
    }
    const socket = this._socket;
    let closed = false;
    this._pendingLeave = () => {
      if (closed) return;
      closed = true;
      this._pendingLeave = null;
      socket.disconnect();
    };
    const finish = this._pendingLeave;
    socket.emit('leave', finish);
    this._setTimeout(finish, LEAVE_ACK_TIMEOUT_MS);
    this._terminate('closed', 'left', { keepSocket: true });
  }

  /** Closes the socket and drops every listener. The instance cannot be reused. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._offPageHide?.();
    this._offPageHide = null;
    this._clearTimers();
    for (const [event, handler] of this._socketHandlers) this._socket.off(event, handler);
    this._socketHandlers = [];
    // A leave in flight closes the socket itself once acknowledged.
    if (!this._pendingLeave) this._socket.disconnect();
    for (const channel of [
      this._stateChannel, this._joinedChannel, this._presenceChannel, this._actionChannel, this._healthChannel,
      this._peerLeftChannel, this._errorChannel, this._closedChannel, this._connectionChannel,
    ]) channel.clear();
  }

  /**
   * Ephemeral command: sent only while the room is confirmed, never replayed.
   * @returns whether it left this device
   */
  sendAction(payload: ActionPayload): boolean {
    if (!this.joined) return false;
    this._seq += 1;
    this._socket.emit('action', { ...payload, seq: this._seq, sentAt: this._monotonicNow() });
    this._touchToken();
    return true;
  }

  /** Liveness beacon (controller only), same no-buffer rule as actions. */
  sendHealth(payload: HealthPayload): boolean {
    if (!this.joined) return false;
    this._socket.emit('health', { ...payload, sentAt: this._monotonicNow() });
    this._touchToken();
    return true;
  }

  onStateChange(handler: Listener<JoinState>): () => void {
    return this._stateChannel.on(handler);
  }

  onJoined(handler: Listener<RoomSnapshot>): () => void {
    return this._joinedChannel.on(handler);
  }

  onPresence(handler: Listener<RoomSnapshot>): () => void {
    return this._presenceChannel.on(handler);
  }

  onAction(handler: Listener<StampedAction>): () => void {
    return this._actionChannel.on(handler);
  }

  onPeerHealth(handler: Listener<PeerHealth>): () => void {
    return this._healthChannel.on(handler);
  }

  onPeerLeft(handler: Listener<{ role: SignalingRole; reason: string }>): () => void {
    return this._peerLeftChannel.on(handler);
  }

  onJoinError(handler: Listener<{ error: string }>): () => void {
    return this._errorChannel.on(handler);
  }

  onClosed(handler: Listener<{ reason: string }>): () => void {
    return this._closedChannel.on(handler);
  }

  /** True on the transport's own connect/reconnect, false on disconnect. */
  onConnectionChange(handler: Listener<boolean>): () => void {
    return this._connectionChannel.on(handler);
  }

  /**
   * Round-trip time to the signaling server, in ms — a proxy for "connection
   * quality" shown on the TV pairing screen (docs/12 §10). Resolves `null`
   * if no reply arrives within `timeoutMs` (offline, or the socket isn't
   * connected at all).
   */
  measureLatency(timeoutMs = 3000): Promise<number | null> {
    if (!this._socket.connected) return Promise.resolve(null);

    return new Promise((resolve) => {
      const sentAt = Date.now();
      let settled = false;

      const onPong = (echoedAt: unknown) => {
        if (echoedAt !== sentAt || settled) return;
        settled = true;
        this._socket.off('pong-check', onPong as never);
        resolve(Date.now() - sentAt);
      };

      this._socket.on('pong-check', onPong as never);
      this._socket.emit('ping-check', sentAt);

      setTimeout(() => {
        if (settled) return;
        settled = true;
        this._socket.off('pong-check', onPong as never);
        resolve(null);
      }, timeoutMs);
    });
  }

  private _listen(event: string, handler: (payload: never) => void): void {
    const guarded = ((payload: never) => {
      if (!this._disposed) handler(payload);
    }) as (...args: never[]) => void;
    this._socketHandlers.push([event, guarded]);
    this._socket.on(event, guarded);
  }

  /** Keeps the resume token valid while the session is actually in use (or the page is leaving mid-session). */
  private _touchToken(leaving = false): void {
    if (this._state !== 'joined' && !(leaving && !TERMINAL.has(this._state))) return;
    this._tokens.touch?.();
  }

  private _purgeEphemeral(): void {
    const buffer = this._socket.sendBuffer;
    if (!buffer?.length) return;
    const kept = buffer.filter((packet) => !EPHEMERAL_EVENTS.has(packet.data?.[0]));
    if (kept.length !== buffer.length) this._diag('purged-offline-packets', { count: buffer.length - kept.length });
    buffer.splice(0, buffer.length, ...kept);
  }

  private _join(): void {
    if (this._disposed || TERMINAL.has(this._state)) return;
    this._clearTimers();
    if (this._state !== 'waiting-room') this._setState('joining');
    const token = this._tokens.read();
    this._diag('join-sent', { attempt: this._attempts, resume: Boolean(token) });
    this._socket.emit('join', { role: this._role, session: this._session, token, protocol: PROTOCOL_VERSION });
    this._joinTimer = this._setTimeout(() => {
      this._joinTimer = null;
      this._diag('join-timeout', { attempt: this._attempts });
      this._scheduleRetry();
    }, this._joinTimeoutMs);
  }

  private _onJoined(payload: unknown): void {
    const { token, ...snapshot } = (payload ?? {}) as RoomSnapshot & { token?: string };
    if (!snapshot.peers) return;
    this._clearTimers();
    this._attempts = 0;
    this._waitingSince = null;
    this._lastError = null;
    this._snapshot = snapshot;
    if (typeof token === 'string') this._tokens.write(token);
    this._diag('join-ok', { resumed: snapshot.resumed, generation: snapshot.generation });
    this._setState('joined');
    this._joinedChannel.emit(snapshot);
  }

  private _onJoinError(payload: unknown): void {
    const error = ((payload ?? {}) as { error?: string }).error ?? 'unknown';
    this._clearJoinTimer();
    this._lastError = error;
    this._diag('join-error', { error });

    if (error === 'room-not-found' && this._role === 'controller') {
      this._waitingSince ??= this._now();
      if (this._now() - this._waitingSince < this._waitForRoomMs) {
        this._setState('waiting-room');
        this._errorChannel.emit({ error });
        this._scheduleRetry();
        return;
      }
    }
    this._errorChannel.emit({ error });
    this._terminate('rejected', error);
  }

  private _scheduleRetry(): void {
    if (this._disposed || TERMINAL.has(this._state) || this._retryTimer) return;
    const exp = Math.min(this._retryMaxMs, this._retryBaseMs * 2 ** this._attempts);
    const delay = Math.round(exp * (0.5 + this._random() * 0.5));
    this._attempts += 1;
    this._retryTimer = this._setTimeout(() => {
      this._retryTimer = null;
      if (this._socket.connected) this._join();
    }, delay);
  }

  private _terminate(state: 'rejected' | 'replaced' | 'closed', reason: string, { keepSocket = false } = {}): void {
    if (TERMINAL.has(this._state)) return;
    this._clearTimers();
    this._closeReason = reason;
    this._diag('session-end', { state, reason });
    this._setState(state);
    // A replaced/closed socket must not keep reconnecting and fight its successor.
    if (!keepSocket) this._socket.disconnect();
    if (state !== 'rejected') this._closedChannel.emit({ reason });
  }

  private _setState(state: JoinState): void {
    if (this._state === state) return;
    this._state = state;
    this._stateChannel.emit(state);
  }

  private _clearJoinTimer(): void {
    if (this._joinTimer) this._clearTimeout(this._joinTimer);
    this._joinTimer = null;
  }

  private _clearTimers(): void {
    this._clearJoinTimer();
    if (this._retryTimer) this._clearTimeout(this._retryTimer);
    this._retryTimer = null;
  }
}
