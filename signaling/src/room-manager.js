import { randomBytes } from 'node:crypto';
import { isValidSessionId } from './session-id.js';

/**
 * Bumped whenever the join/snapshot/action contract changes. A client built
 * for another version is refused with `version-mismatch` instead of being
 * half understood (docs/19 §4 P0.2).
 */
export const PROTOCOL_VERSION = 3;

// Retention windows, counted from the moment the absence is detected. They say
// how long a room survives for a *recovery*, not how fast the game pauses — the
// viewer pauses on its own health monitor within seconds (docs/19 §4 P0.2/P0.4).
export const DEFAULT_ROOM_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_VIEWER_TTL_MS = 2 * 60 * 1000;
/** A room nobody ever paired a phone with (QR shown, never scanned) also ends. */
export const DEFAULT_UNPAIRED_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_ACTION_RATE_LIMIT = 10;
/** Health beacons arrive about once a second; a few more tolerate a burst on visibility changes. */
export const DEFAULT_HEALTH_RATE_LIMIT = 5;
const RATE_WINDOW_MS = 1000;
const ROLES = ['viewer', 'controller'];
const SENSOR_STATES = new Set(['ok', 'stale', 'none']);

/**
 * The phone's own monotonic send time, relayed untouched so the viewer can
 * estimate how late a command arrived (docs/19 §4 P0.5). Never compared with
 * the server's or the viewer's clock here.
 */
function sentAtOf(payload) {
  const sentAt = payload?.sentAt;
  return typeof sentAt === 'number' && Number.isFinite(sentAt) && sentAt >= 0 ? sentAt : null;
}

/** Only a prefix of the pairing code reaches the logs (docs/19 §4 P0.1). */
export function maskSession(session) {
  return typeof session === 'string' ? `${session.slice(0, 2)}…` : '-';
}

function defaultCreateToken() {
  return randomBytes(18).toString('base64url');
}

/**
 * @typedef {Object} Peer
 * @property {string} id
 * @property {(event: string, payload?: unknown) => void} emit
 */

/**
 * @typedef {Object} RoomSnapshot
 * @property {number} protocol
 * @property {'viewer' | 'controller'} role  role of the peer receiving it
 * @property {boolean} resumed  the join was authenticated by a resume token
 * @property {number} generation  bumped on every controller (re)join
 * @property {{ viewer: boolean, controller: boolean }} peers
 */

/**
 * Single responsibility: track `{ session -> { viewer, controller } }` rooms
 * and forward messages from the controller (phone) to the viewer (game on the
 * TV). It never interprets a message — "jump" is just a string to this class,
 * same separation the InputAdapter contract enforces on the client (see
 * docs/12-controle-por-celular.md §2-3).
 *
 * Each role owns a resume token issued on join. A new socket carrying that
 * token atomically replaces the old one (a reload or a network switch that
 * overlaps both connections), while the pairing code alone can only fill an
 * empty slot — it never evicts a live peer (docs/19 §4 P0.4). Every transition
 * checks that the peer is still the room's current one, so late events from a
 * replaced socket never touch the session that replaced it.
 *
 * Framework-agnostic on purpose: it only needs `Peer.emit`, so it is unit
 * testable without a real socket.io server (see room-manager.test.js) and
 * `server.js` is the only place that touches socket.io.
 */
export class RoomManager {
  #rooms = new Map();
  #peers = new Map();
  #roomTtlMs;
  #viewerTtlMs;
  #unpairedTtlMs;
  #actionRateLimit;
  #healthRateLimit;
  #now;
  #setTimeout;
  #clearTimeout;
  #createToken;
  #log;

  constructor({
    roomTtlMs = DEFAULT_ROOM_TTL_MS,
    viewerTtlMs = DEFAULT_VIEWER_TTL_MS,
    unpairedTtlMs = DEFAULT_UNPAIRED_TTL_MS,
    actionRateLimit = DEFAULT_ACTION_RATE_LIMIT,
    healthRateLimit = DEFAULT_HEALTH_RATE_LIMIT,
    now = () => Date.now(),
    setTimeoutFn = (...args) => setTimeout(...args),
    clearTimeoutFn = (...args) => clearTimeout(...args),
    createToken = defaultCreateToken,
    log = (level, message) => console[level](message),
  } = {}) {
    this.#roomTtlMs = roomTtlMs;
    this.#viewerTtlMs = viewerTtlMs;
    this.#unpairedTtlMs = unpairedTtlMs;
    this.#actionRateLimit = actionRateLimit;
    this.#healthRateLimit = healthRateLimit;
    this.#now = now;
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
    this.#createToken = createToken;
    this.#log = log;
  }

  get roomCount() {
    return this.#rooms.size;
  }

  /**
   * Idempotent: the same socket joining twice keeps its generation, token and
   * counters and just gets a fresh snapshot, so a client may retry a join whose
   * confirmation it never saw without invalidating its own commands in flight.
   *
   * @param {Peer} peer
   * @param {{ role: 'viewer' | 'controller', session: string, token?: string, protocol?: number }} payload
   * @returns {{ ok: true, snapshot: RoomSnapshot, token: string } | { ok: false, error: string }}
   */
  join(peer, payload) {
    const { role, session, token, protocol } = payload ?? {};
    if (protocol !== PROTOCOL_VERSION) return this.#reject(peer, session, 'version-mismatch');
    if (!ROLES.includes(role)) return this.#reject(peer, session, 'invalid-role');
    if (!isValidSessionId(session)) return this.#reject(peer, session, 'invalid-session');

    const previous = this.#peers.get(peer.id);
    if (previous && (previous.session !== session || previous.role !== role)) {
      return this.#reject(peer, session, 'already-joined');
    }

    let room = this.#rooms.get(session);
    if (previous && room && room[role] === peer) {
      return { ok: true, snapshot: this.#snapshot(room, role, previous.resumed), token: room[`${role}Token`] };
    }
    if (!room) {
      // Only the TV creates rooms. After a server restart the phone arrives
      // with a token for a room that no longer exists: it is told so and
      // retries until the TV's own reconnect recreates it (docs/19 §4 P0.4).
      if (role === 'controller') return this.#reject(peer, session, 'room-not-found');
      room = this.#createRoom(session);
    }

    const tokenField = `${role}Token`;
    const current = room[role];
    const resumed = typeof token === 'string' && token.length > 0 && token === room[tokenField];

    if (current && current.id !== peer.id) {
      // The code in the QR alone never evicts a live peer — that is how a
      // second phone is kept out of another child's session.
      if (!resumed) return this.#reject(peer, session, 'room-full');
      this.#detach(current, 'replaced');
    }

    this.#cancelTimer(room, `${role}ExpiryTimer`);
    room[role] = peer;
    if (!room[tokenField] || !resumed) room[tokenField] = this.#createToken();
    if (role === 'controller') {
      room.everPaired = true;
      room.generation += 1;
      this.#cancelTimer(room, 'unpairedExpiryTimer');
    }
    this.#peers.set(peer.id, { peer, session, role, resumed, actionTimestamps: [], healthTimestamps: [] });

    this.#log('log', `[signaling] join ok peer=${peer.id} role=${role} session=${maskSession(session)} resumed=${resumed}`);

    // Both sides always end up with the same authoritative view of the room,
    // whichever joined last or came back first.
    const other = role === 'viewer' ? room.controller : room.viewer;
    other?.emit('presence', this.#snapshot(room, role === 'viewer' ? 'controller' : 'viewer', false));
    other?.emit('peer-joined', { role, generation: room.generation });

    return { ok: true, snapshot: this.#snapshot(room, role, resumed), token: room[tokenField] };
  }

  /**
   * Movement commands are ephemeral: forwarded at most once, stamped with the
   * room's current controller generation so the viewer can drop anything
   * belonging to an earlier connection (docs/19 §4 P0.5).
   *
   * @param {Peer} peer
   * @param {{ button: string, pressed: boolean, seq?: number, sentAt?: number }} payload
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  action(peer, payload) {
    const entry = this.#currentEntry(peer);
    if (!entry || entry.role !== 'controller') return { ok: false, error: 'not-a-controller' };

    if (this.#isRateLimited(entry.actionTimestamps, this.#actionRateLimit)) return { ok: false, error: 'rate-limited' };

    if (typeof payload?.button !== 'string' || typeof payload?.pressed !== 'boolean') {
      return { ok: false, error: 'invalid-payload' };
    }
    const seq = Number.isSafeInteger(payload.seq) && payload.seq >= 0 ? payload.seq : null;

    const room = this.#rooms.get(entry.session);
    // The viewer (TV) can itself be mid-reconnect when this arrives — the
    // jump is simply lost, same as a message crossing an actual network gap.
    room?.viewer?.emit('action', {
      button: payload.button,
      pressed: payload.pressed,
      seq,
      sentAt: sentAtOf(payload),
      generation: room.generation,
    });
    return { ok: true };
  }

  /**
   * The phone's liveness beacon (sensor + page state), relayed as-is. The
   * viewer times it with its own clock; the phone's timestamps are never
   * compared across devices.
   *
   * @param {Peer} peer
   * @param {{ sensor: 'ok' | 'stale' | 'none', visible: boolean, sentAt?: number }} payload
   */
  health(peer, payload) {
    const entry = this.#currentEntry(peer);
    if (!entry || entry.role !== 'controller') return { ok: false, error: 'not-a-controller' };
    if (this.#isRateLimited(entry.healthTimestamps, this.#healthRateLimit)) return { ok: false, error: 'rate-limited' };
    if (!SENSOR_STATES.has(payload?.sensor) || typeof payload?.visible !== 'boolean') {
      return { ok: false, error: 'invalid-payload' };
    }
    const room = this.#rooms.get(entry.session);
    room?.viewer?.emit('peer-health', {
      sensor: payload.sensor,
      visible: payload.visible,
      sentAt: sentAtOf(payload),
      generation: room.generation,
    });
    return { ok: true };
  }

  /**
   * Explicit end, as opposed to a dropped connection. The TV leaving ends the
   * session for both; the phone leaving frees its slot (and its token) at once.
   *
   * @param {Peer} peer
   */
  leave(peer) {
    const entry = this.#currentEntry(peer);
    if (!entry) return;
    const room = this.#rooms.get(entry.session);
    this.#peers.delete(peer.id);
    if (!room) return;
    this.#log('log', `[signaling] leave peer=${peer.id} role=${entry.role} session=${maskSession(entry.session)}`);

    if (entry.role === 'viewer') {
      room.viewer = null;
      this.#closeRoom(room, 'ended');
      return;
    }
    room.controller = null;
    room.controllerToken = null;
    this.#cancelTimer(room, 'controllerExpiryTimer');
    room.viewer?.emit('peer-left', { role: 'controller', reason: 'left' });
    room.viewer?.emit('presence', this.#snapshot(room, 'viewer', false));
  }

  /**
   * @param {Peer} peer
   * @param {string} [reason] transport reason, logged only
   */
  disconnect(peer, reason = 'unknown') {
    const entry = this.#peers.get(peer.id);
    if (!entry) return;
    this.#peers.delete(peer.id);

    const room = this.#rooms.get(entry.session);
    // A replaced socket's late disconnect must never clear its successor.
    if (!room || room[entry.role] !== peer) return;
    this.#log('log', `[signaling] disconnect peer=${peer.id} role=${entry.role} session=${maskSession(entry.session)} reason=${reason}`);

    room[entry.role] = null;
    const other = entry.role === 'viewer' ? room.controller : room.viewer;
    other?.emit('peer-left', { role: entry.role, reason: 'dropped' });
    other?.emit('presence', this.#snapshot(room, entry.role === 'viewer' ? 'controller' : 'viewer', false));

    const ttl = entry.role === 'viewer' ? this.#viewerTtlMs : this.#roomTtlMs;
    const timerField = `${entry.role}ExpiryTimer`;
    this.#cancelTimer(room, timerField);
    room[timerField] = this.#setTimeout(() => {
      room[timerField] = null;
      if (this.#rooms.get(entry.session) !== room || room[entry.role]) return;
      this.#closeRoom(room, 'expired');
    }, ttl);
  }

  #createRoom(session) {
    const room = {
      session,
      viewer: null,
      controller: null,
      viewerToken: null,
      controllerToken: null,
      generation: 0,
      everPaired: false,
      viewerExpiryTimer: null,
      controllerExpiryTimer: null,
      unpairedExpiryTimer: null,
    };
    room.unpairedExpiryTimer = this.#setTimeout(() => {
      room.unpairedExpiryTimer = null;
      if (this.#rooms.get(session) !== room || room.everPaired) return;
      this.#closeRoom(room, 'expired');
    }, this.#unpairedTtlMs);
    this.#rooms.set(session, room);
    return room;
  }

  /** Ends a room for good: timers, peer index and tokens go, and whoever is still connected is told. */
  #closeRoom(room, reason) {
    for (const field of ['viewerExpiryTimer', 'controllerExpiryTimer', 'unpairedExpiryTimer']) this.#cancelTimer(room, field);
    for (const role of ROLES) {
      const peer = room[role];
      if (!peer) continue;
      this.#peers.delete(peer.id);
      peer.emit('room-closed', { reason });
      room[role] = null;
    }
    room.viewerToken = null;
    room.controllerToken = null;
    if (this.#rooms.get(room.session) === room) this.#rooms.delete(room.session);
    this.#log('log', `[signaling] room closed session=${maskSession(room.session)} reason=${reason}`);
  }

  /** Forgets a peer that lost its slot and tells it to stop reconnecting. */
  #detach(peer, reason) {
    this.#peers.delete(peer.id);
    peer.emit('session-replaced', { reason });
  }

  /** The peer's entry, only while it still holds its slot in the room. */
  #currentEntry(peer) {
    const entry = this.#peers.get(peer.id);
    if (!entry) return null;
    const room = this.#rooms.get(entry.session);
    return room && room[entry.role] === peer ? entry : null;
  }

  #snapshot(room, role, resumed) {
    return {
      protocol: PROTOCOL_VERSION,
      role,
      resumed,
      generation: room.generation,
      peers: { viewer: Boolean(room.viewer), controller: Boolean(room.controller) },
    };
  }

  #reject(peer, session, error) {
    this.#log('error', `[signaling] join rejected: ${error} peer=${peer.id} session=${maskSession(session)}`);
    return { ok: false, error };
  }

  #isRateLimited(timestamps, limit) {
    const now = this.#now();
    const cutoff = now - RATE_WINDOW_MS;
    while (timestamps.length && timestamps[0] <= cutoff) timestamps.shift();
    if (timestamps.length >= limit) return true;
    timestamps.push(now);
    return false;
  }

  #cancelTimer(room, field) {
    if (room[field]) {
      this.#clearTimeout(room[field]);
      room[field] = null;
    }
  }
}
