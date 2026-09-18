import { isValidSessionId } from './session-id.js';

export const DEFAULT_ROOM_TTL_MS = 5 * 60 * 1000;
// Much shorter than the controller's grace period on purpose: a phone can
// legitimately sit backgrounded/screen-locked for minutes before anyone
// notices, but the TV's own WiFi wobbling is expected to resolve within
// socket.io's own automatic reconnect (seconds) — a longer window here would
// just leave the phone showing "reconectando" for a while after a game that
// actually already ended (tab closed).
export const DEFAULT_VIEWER_TTL_MS = 15 * 1000;
export const DEFAULT_ACTION_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 1000;

/**
 * @typedef {Object} Peer
 * @property {string} id
 * @property {(event: string, payload?: unknown) => void} emit
 */

/**
 * Single responsibility: track `{ session -> { viewer, controller } }` rooms
 * and forward `action` messages from the controller (phone) to the viewer
 * (game on the TV). It never interprets a message — "jump" is just a string
 * to this class, same separation the InputAdapter contract enforces on the
 * client (see docs/12-controle-por-celular.md §2-3).
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
  #actionRateLimit;
  #now;
  #setTimeout;
  #clearTimeout;

  constructor({
    roomTtlMs = DEFAULT_ROOM_TTL_MS,
    viewerTtlMs = DEFAULT_VIEWER_TTL_MS,
    actionRateLimit = DEFAULT_ACTION_RATE_LIMIT,
    now = () => Date.now(),
    setTimeoutFn = (...args) => setTimeout(...args),
    clearTimeoutFn = (...args) => clearTimeout(...args),
  } = {}) {
    this.#roomTtlMs = roomTtlMs;
    this.#viewerTtlMs = viewerTtlMs;
    this.#actionRateLimit = actionRateLimit;
    this.#now = now;
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
  }

  get roomCount() {
    return this.#rooms.size;
  }

  /**
   * @param {Peer} peer
   * @param {{ role: 'viewer' | 'controller', session: string }} payload
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  join(peer, payload) {
    const { role, session } = payload ?? {};
    if (role !== 'viewer' && role !== 'controller') {
      console.error(`[signaling] join rejected: invalid-role peer=${peer.id} role=${role}`);
      return { ok: false, error: 'invalid-role' };
    }
    if (!isValidSessionId(session)) {
      console.error(`[signaling] join rejected: invalid-session peer=${peer.id} session=${session}`);
      return { ok: false, error: 'invalid-session' };
    }

    let room = this.#rooms.get(session);

    if (role === 'viewer') {
      if (!room) {
        room = { session, viewer: null, controller: null, viewerExpiryTimer: null, controllerExpiryTimer: null };
        this.#rooms.set(session, room);
      }
      // The TV's own WiFi can hiccup too (see disconnect() below) — a
      // reconnect here must cancel any pending "viewer gone" expiry, exactly
      // like a controller reconnect cancels its own.
      this.#cancelTimer(room, 'viewerExpiryTimer');
      room.viewer = peer;
    } else {
      if (!room) {
        console.error(`[signaling] join rejected: room-not-found peer=${peer.id} session=${session}`);
        return { ok: false, error: 'room-not-found' };
      }
      // A second, different phone must never slip into another child's
      // session — only the phone already paired (or a first pairing) wins.
      if (room.controller && room.controller.id !== peer.id) {
        console.error(`[signaling] join rejected: room-full peer=${peer.id} session=${session}`);
        return { ok: false, error: 'room-full' };
      }
      this.#cancelTimer(room, 'controllerExpiryTimer');
      room.controller = peer;
      room.viewer?.emit('peer-joined', { role: 'controller' });
    }

    console.log(`[signaling] join ok peer=${peer.id} role=${role} session=${session}`);
    this.#peers.set(peer.id, { peer, session, role, actionTimestamps: [] });
    return { ok: true };
  }

  /**
   * @param {Peer} peer
   * @param {{ button: string, pressed: boolean }} payload
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  action(peer, payload) {
    const entry = this.#peers.get(peer.id);
    if (!entry || entry.role !== 'controller') return { ok: false, error: 'not-a-controller' };

    if (this.#isRateLimited(entry)) return { ok: false, error: 'rate-limited' };

    if (typeof payload?.button !== 'string' || typeof payload?.pressed !== 'boolean') {
      return { ok: false, error: 'invalid-payload' };
    }

    const room = this.#rooms.get(entry.session);
    // The viewer (TV) can itself be mid-reconnect when this arrives — the
    // jump is simply lost, same as a message crossing an actual network
    // gap in transit. No special-casing needed either side.
    room?.viewer?.emit('action', { button: payload.button, pressed: payload.pressed });
    return { ok: true };
  }

  /** @param {Peer} peer */
  disconnect(peer) {
    const entry = this.#peers.get(peer.id);
    if (!entry) return;
    this.#peers.delete(peer.id);
    console.log(`[signaling] disconnect peer=${peer.id} role=${entry.role} session=${entry.session}`);

    const room = this.#rooms.get(entry.session);
    if (!room) return;

    if (entry.role === 'viewer') {
      // The TV is on WiFi too — a dropped connection there deserves the same
      // reconnect grace period as the phone gets below, not an instant
      // teardown. Only the controller is told anything right now (so it
      // knows pairing is momentarily unwatched); the room itself survives.
      room.viewer = null;
      room.viewerExpiryTimer = this.#setTimeout(() => {
        if (this.#rooms.get(entry.session) !== room) return; // already gone/replaced
        room.controller?.emit('room-closed');
        this.#rooms.delete(entry.session);
      }, this.#viewerTtlMs);
      return;
    }

    // Controller (phone) dropped: WiFi hiccup, backgrounded app, screen
    // lock. Tell the TV immediately so it can pause instead of letting
    // auto-run keep going with nobody able to jump (docs/12 §10, "critical").
    room.controller = null;
    room.viewer?.emit('peer-left', { role: 'controller' });
    room.controllerExpiryTimer = this.#setTimeout(() => {
      if (this.#rooms.get(entry.session) !== room) return;
      this.#rooms.delete(entry.session);
    }, this.#roomTtlMs);
  }

  #isRateLimited(entry) {
    const now = this.#now();
    const cutoff = now - RATE_WINDOW_MS;
    entry.actionTimestamps = entry.actionTimestamps.filter((t) => t > cutoff);
    if (entry.actionTimestamps.length >= this.#actionRateLimit) return true;
    entry.actionTimestamps.push(now);
    return false;
  }

  #cancelTimer(room, field) {
    if (room[field]) {
      this.#clearTimeout(room[field]);
      room[field] = null;
    }
  }
}
