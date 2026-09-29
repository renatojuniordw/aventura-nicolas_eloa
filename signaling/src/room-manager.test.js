import { describe, it, expect, vi } from 'vitest';
import { RoomManager, PROTOCOL_VERSION, maskSession } from './room-manager.js';

const SESSION = 'AB23CD45';
const OTHER_SESSION = 'ZZ99YY88';

function makePeer(id) {
  return { id, emit: vi.fn() };
}

const viewer = (extra = {}) => ({ role: 'viewer', session: SESSION, protocol: PROTOCOL_VERSION, ...extra });
const controller = (extra = {}) => ({ role: 'controller', session: SESSION, protocol: PROTOCOL_VERSION, ...extra });

function makeManager(overrides = {}) {
  let time = 0;
  const timers = new Map();
  let nextTimerId = 1;
  let nextToken = 1;
  const logs = [];
  const fireTimer = (id) => {
    const timer = timers.get(id);
    timers.delete(id);
    timer?.fn();
  };
  return {
    manager: new RoomManager({
      now: () => time,
      setTimeoutFn: (fn, ms) => {
        const id = nextTimerId++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeoutFn: (id) => timers.delete(id),
      createToken: () => `token-${nextToken++}`,
      log: (level, message) => logs.push(message),
      ...overrides,
    }),
    advance(ms) {
      time += ms;
    },
    fireTimer,
    /** Fires every pending timer scheduled with exactly `ms`. */
    fireTimersOf(ms) {
      for (const [id, timer] of [...timers]) if (timer.ms === ms) fireTimer(id);
    },
    timers,
    logs,
  };
}

/** Viewer + controller paired; returns both peers and their tokens. */
function pair(manager, { tvId = 'tv-1', phoneId = 'phone-1' } = {}) {
  const tv = makePeer(tvId);
  const phone = makePeer(phoneId);
  const tvJoin = manager.join(tv, viewer());
  const phoneJoin = manager.join(phone, controller());
  return { tv, phone, tvToken: tvJoin.token, phoneToken: phoneJoin.token };
}

describe('RoomManager: pairing', () => {
  it('lets a viewer create a room and a controller join it, with a snapshot for each side', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');

    const tvJoin = manager.join(tv, viewer());
    expect(tvJoin).toMatchObject({
      ok: true,
      token: expect.any(String),
      snapshot: { protocol: PROTOCOL_VERSION, role: 'viewer', resumed: false, peers: { viewer: true, controller: false } },
    });

    const phoneJoin = manager.join(phone, controller());
    expect(phoneJoin).toMatchObject({ ok: true, snapshot: { role: 'controller', generation: 1, peers: { viewer: true, controller: true } } });
    expect(tv.emit).toHaveBeenCalledWith('peer-joined', { role: 'controller', generation: 1 });
    expect(tv.emit).toHaveBeenCalledWith('presence', expect.objectContaining({ peers: { viewer: true, controller: true } }));
  });

  it('rejects a controller for a session with no viewer', () => {
    const { manager } = makeManager();
    expect(manager.join(makePeer('phone-1'), controller())).toEqual({ ok: false, error: 'room-not-found' });
  });

  it('rejects a client speaking another protocol version', () => {
    const { manager } = makeManager();
    expect(manager.join(makePeer('tv'), { role: 'viewer', session: SESSION })).toEqual({ ok: false, error: 'version-mismatch' });
    expect(manager.join(makePeer('tv'), viewer({ protocol: PROTOCOL_VERSION + 1 }))).toEqual({ ok: false, error: 'version-mismatch' });
  });

  it('rejects a second, different controller for an already-paired room', () => {
    const { manager } = makeManager();
    pair(manager);
    expect(manager.join(makePeer('phone-b'), controller())).toEqual({ ok: false, error: 'room-full' });
  });

  it('a wrong token does not evict the live controller either', () => {
    const { manager } = makeManager();
    pair(manager);
    expect(manager.join(makePeer('phone-b'), controller({ token: 'guess' }))).toEqual({ ok: false, error: 'room-full' });
  });

  it('is idempotent for the same socket joining again (lost confirmation)', () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);
    const first = manager.join(phone, controller());
    // Retrying without the token it never saw keeps identity, generation and credential.
    const again = manager.join(phone, controller());
    expect(again).toEqual(first);
    expect(again).toMatchObject({ ok: true, snapshot: { generation: 1 } });
    const viewerAgain = manager.join(tv, viewer());
    expect(viewerAgain).toMatchObject({ ok: true, snapshot: { generation: 1 } });
    // Commands in flight from before the retry still carry the current generation.
    manager.action(phone, { button: 'jump', pressed: true, seq: 1 });
    expect(tv.emit).toHaveBeenCalledWith('action', expect.objectContaining({ seq: 1, generation: 1 }));
  });

  it('a repeated resumed join keeps reporting it was resumed', () => {
    const { manager } = makeManager();
    const { phone, phoneToken } = pair(manager);
    const phoneAgain = makePeer('phone-2');
    expect(manager.join(phoneAgain, controller({ token: phoneToken }))).toMatchObject({ snapshot: { resumed: true, generation: 2 } });
    expect(manager.join(phoneAgain, controller({ token: phoneToken }))).toMatchObject({ token: phoneToken, snapshot: { resumed: true, generation: 2 } });
    expect(phone.emit).toHaveBeenCalledWith('session-replaced', expect.anything());
  });

  it('refuses a socket that tries to switch session or role', () => {
    const { manager } = makeManager();
    const { phone } = pair(manager);
    expect(manager.join(phone, controller({ session: OTHER_SESSION }))).toEqual({ ok: false, error: 'already-joined' });
    expect(manager.join(phone, viewer())).toEqual({ ok: false, error: 'already-joined' });
  });

  it('rejects malformed session ids and unknown roles', () => {
    const { manager } = makeManager();
    const peer = makePeer('p-1');
    expect(manager.join(peer, viewer({ session: 'short' }))).toEqual({ ok: false, error: 'invalid-session' });
    expect(manager.join(peer, viewer({ role: 'referee' }))).toEqual({ ok: false, error: 'invalid-role' });
  });

  it('keeps two sessions fully isolated from each other', () => {
    const { manager } = makeManager();
    const tvA = makePeer('tv-a');
    const tvB = makePeer('tv-b');
    const phoneA = makePeer('phone-a');
    manager.join(tvA, viewer());
    manager.join(tvB, viewer({ session: OTHER_SESSION }));
    manager.join(phoneA, controller());

    manager.action(phoneA, { button: 'jump', pressed: true, seq: 1 });

    expect(tvA.emit).toHaveBeenCalledWith('action', expect.objectContaining({ button: 'jump' }));
    expect(tvB.emit).not.toHaveBeenCalledWith('action', expect.anything());
  });

  it('never writes the full pairing code or the tokens to the logs', () => {
    const { manager, logs } = makeManager();
    const { phone, phoneToken } = pair(manager);
    manager.disconnect(phone, 'transport close');
    const text = logs.join('\n');
    expect(text).not.toContain(SESSION);
    expect(text).not.toContain(phoneToken);
    expect(text).toContain(maskSession(SESSION));
    expect(text).toContain('reason=transport close');
  });
});

describe('RoomManager: authenticated resume', () => {
  it('a new socket with the controller token replaces the old one without room-full', () => {
    const { manager } = makeManager();
    const { tv, phone, phoneToken } = pair(manager);
    const phoneAgain = makePeer('phone-2');

    const result = manager.join(phoneAgain, controller({ token: phoneToken }));

    expect(result).toMatchObject({ ok: true, token: phoneToken, snapshot: { resumed: true, generation: 2 } });
    expect(phone.emit).toHaveBeenCalledWith('session-replaced', { reason: 'replaced' });

    manager.action(phoneAgain, { button: 'jump', pressed: true, seq: 1 });
    expect(tv.emit).toHaveBeenCalledWith('action', { button: 'jump', pressed: true, seq: 1, sentAt: null, generation: 2 });
  });

  it('the replaced socket can no longer send actions', () => {
    const { manager } = makeManager();
    const { tv, phone, phoneToken } = pair(manager);
    manager.join(makePeer('phone-2'), controller({ token: phoneToken }));
    tv.emit.mockClear();

    expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: false, error: 'not-a-controller' });
    expect(tv.emit).not.toHaveBeenCalled();
  });

  it("a late disconnect from the replaced controller does not clear its successor", () => {
    const { manager } = makeManager();
    const { tv, phone, phoneToken } = pair(manager);
    const phoneAgain = makePeer('phone-2');
    manager.join(phoneAgain, controller({ token: phoneToken }));
    tv.emit.mockClear();

    manager.disconnect(phone, 'ping timeout');

    expect(tv.emit).not.toHaveBeenCalledWith('peer-left', expect.anything());
    expect(manager.action(phoneAgain, { button: 'jump', pressed: true })).toEqual({ ok: true });
  });

  it('a replaced viewer disconnecting late leaves the new viewer receiving actions', () => {
    const { manager } = makeManager();
    const { tv: oldTv, phone, tvToken } = pair(manager);
    const newTv = makePeer('tv-2');
    manager.join(newTv, viewer({ token: tvToken }));

    manager.disconnect(oldTv, 'transport close');
    manager.action(phone, { button: 'jump', pressed: true, seq: 3 });

    expect(newTv.emit).toHaveBeenCalledWith('action', expect.objectContaining({ seq: 3 }));
  });

  it('a new viewer without the token cannot take over a live viewer', () => {
    const { manager } = makeManager();
    pair(manager);
    expect(manager.join(makePeer('tv-evil'), viewer())).toEqual({ ok: false, error: 'room-full' });
  });

  it('after a drop, the pairing code alone fills the empty slot with a fresh token', () => {
    const { manager } = makeManager();
    const { phone, phoneToken } = pair(manager);
    manager.disconnect(phone, 'transport close');

    const result = manager.join(makePeer('phone-2'), controller());

    expect(result).toMatchObject({ ok: true, snapshot: { resumed: false } });
    expect(result.token).not.toBe(phoneToken);
  });

  it('two concurrent resumes with the same token end with exactly one controller', () => {
    const { manager } = makeManager();
    const { tv, phoneToken } = pair(manager);
    const a = makePeer('phone-a');
    const b = makePeer('phone-b');
    manager.join(a, controller({ token: phoneToken }));
    manager.join(b, controller({ token: phoneToken }));
    tv.emit.mockClear();

    expect(manager.action(a, { button: 'jump', pressed: true })).toEqual({ ok: false, error: 'not-a-controller' });
    expect(manager.action(b, { button: 'jump', pressed: true })).toEqual({ ok: true });
  });

  it('the viewer coming back tells the waiting controller, with a fresh snapshot', () => {
    const { manager } = makeManager();
    const { tv, phone, tvToken } = pair(manager);
    manager.disconnect(tv, 'transport close');
    expect(phone.emit).toHaveBeenCalledWith('peer-left', { role: 'viewer', reason: 'dropped' });

    manager.join(makePeer('tv-2'), viewer({ token: tvToken }));

    expect(phone.emit).toHaveBeenCalledWith('peer-joined', expect.objectContaining({ role: 'viewer' }));
    expect(phone.emit).toHaveBeenLastCalledWith('peer-joined', expect.anything());
    expect(phone.emit).toHaveBeenCalledWith('presence', expect.objectContaining({ role: 'controller', peers: { viewer: true, controller: true } }));
  });

  it('after a server restart the controller waits (room-not-found) until the viewer recreates the room', () => {
    const { manager } = makeManager();
    const phone = makePeer('phone-1');
    expect(manager.join(phone, controller({ token: 'from-before-restart' }))).toEqual({ ok: false, error: 'room-not-found' });

    manager.join(makePeer('tv-1'), viewer({ token: 'also-stale' }));
    expect(manager.join(phone, controller({ token: 'from-before-restart' }))).toMatchObject({ ok: true, snapshot: { resumed: false } });
  });
});

describe('RoomManager: action forwarding', () => {
  it('forwards a controller action, stamped with the generation, only to the viewer of the same room', () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);

    expect(manager.action(phone, { button: 'jump', pressed: true, seq: 7 })).toEqual({ ok: true });
    expect(tv.emit).toHaveBeenCalledWith('action', { button: 'jump', pressed: true, seq: 7, sentAt: null, generation: 1 });
  });

  it("relays the phone's own send time untouched, and only a valid one", () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);
    manager.action(phone, { button: 'jump', pressed: true, seq: 1, sentAt: 1234.5 });
    expect(tv.emit).toHaveBeenLastCalledWith('action', expect.objectContaining({ sentAt: 1234.5 }));
    manager.action(phone, { button: 'jump', pressed: true, seq: 2, sentAt: 'soon' });
    expect(tv.emit).toHaveBeenLastCalledWith('action', expect.objectContaining({ sentAt: null }));
    manager.health(phone, { sensor: 'ok', visible: true, sentAt: 99 });
    expect(tv.emit).toHaveBeenLastCalledWith('peer-health', { sensor: 'ok', visible: true, sentAt: 99, generation: 1 });
  });

  it('never lets a viewer emit an action (transport never decides game rules)', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    manager.join(tv, viewer());
    expect(manager.action(tv, { button: 'jump', pressed: true })).toEqual({ ok: false, error: 'not-a-controller' });
  });

  it('rejects a malformed action payload', () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);
    expect(manager.action(phone, { button: 'jump' })).toEqual({ ok: false, error: 'invalid-payload' });
    expect(manager.action(phone, { pressed: true })).toEqual({ ok: false, error: 'invalid-payload' });
    expect(tv.emit).not.toHaveBeenCalledWith('action', expect.anything());
  });

  it('rate-limits a controller sending too many actions per second', () => {
    const { manager, advance } = makeManager();
    const { phone } = pair(manager);
    for (let i = 0; i < 10; i += 1) {
      expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: true });
    }
    expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: false, error: 'rate-limited' });
    advance(1001);
    expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: true });
  });

  it('relays the health beacon to the viewer and validates it', () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);
    expect(manager.health(phone, { sensor: 'ok', visible: true })).toEqual({ ok: true });
    expect(tv.emit).toHaveBeenCalledWith('peer-health', { sensor: 'ok', visible: true, sentAt: null, generation: 1 });
    expect(manager.health(phone, { sensor: 'weird', visible: true })).toEqual({ ok: false, error: 'invalid-payload' });
    expect(manager.health(tv, { sensor: 'ok', visible: true })).toEqual({ ok: false, error: 'not-a-controller' });
  });
});

describe('RoomManager: disconnects, leaving and expiry', () => {
  it('gives the viewer a reconnect grace period instead of tearing the room down instantly', () => {
    const { manager, timers } = makeManager();
    const { tv, phone } = pair(manager);
    manager.disconnect(tv);
    expect(phone.emit).not.toHaveBeenCalledWith('room-closed', expect.anything());
    expect(manager.roomCount).toBe(1);
    expect([...timers.values()].some((t) => t.ms === 2 * 60 * 1000)).toBe(true);
  });

  it('lets the viewer reconnect within the grace period, cancelling the pending teardown', () => {
    const { manager, fireTimersOf, timers } = makeManager();
    const { tv, phone, tvToken } = pair(manager);
    manager.disconnect(tv);
    manager.join(makePeer('tv-2'), viewer({ token: tvToken }));
    expect([...timers.values()].some((t) => t.ms === 2 * 60 * 1000)).toBe(false);
    fireTimersOf(2 * 60 * 1000);
    expect(manager.roomCount).toBe(1);
    expect(phone.emit).not.toHaveBeenCalledWith('room-closed', expect.anything());
  });

  it('expires the room and tells the controller once the viewer never comes back', () => {
    const { manager, fireTimersOf } = makeManager();
    const { tv, phone } = pair(manager);
    manager.disconnect(tv);
    fireTimersOf(2 * 60 * 1000);
    expect(phone.emit).toHaveBeenCalledWith('room-closed', { reason: 'expired' });
    expect(manager.roomCount).toBe(0);
  });

  it('expires the room and tells the still-connected viewer once the controller never comes back', () => {
    const { manager, fireTimersOf } = makeManager();
    const { tv, phone } = pair(manager);
    manager.disconnect(phone);
    expect(tv.emit).toHaveBeenCalledWith('peer-left', { role: 'controller', reason: 'dropped' });
    fireTimersOf(5 * 60 * 1000);
    expect(tv.emit).toHaveBeenCalledWith('room-closed', { reason: 'expired' });
    expect(manager.roomCount).toBe(0);
    // Tokens are gone with the room: a later join is a brand-new room.
    expect(manager.join(makePeer('tv-9'), viewer())).toMatchObject({ ok: true, snapshot: { resumed: false } });
  });

  it('lets the same phone reconnect after a drop, cancelling the expiry', () => {
    const { manager, fireTimersOf } = makeManager();
    const { phone, phoneToken } = pair(manager);
    manager.disconnect(phone);
    manager.join(makePeer('phone-2'), controller({ token: phoneToken }));
    fireTimersOf(5 * 60 * 1000);
    expect(manager.roomCount).toBe(1);
  });

  it('expires a room whose QR was never scanned', () => {
    const { manager, fireTimersOf } = makeManager();
    const tv = makePeer('tv-1');
    manager.join(tv, viewer());
    fireTimersOf(15 * 60 * 1000);
    expect(tv.emit).toHaveBeenCalledWith('room-closed', { reason: 'expired' });
    expect(manager.roomCount).toBe(0);
  });

  it('a paired room is not ended by the first-pairing timer', () => {
    const { manager, fireTimersOf } = makeManager();
    pair(manager);
    fireTimersOf(15 * 60 * 1000);
    expect(manager.roomCount).toBe(1);
  });

  it('the TV leaving explicitly ends the session for the phone at once', () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);
    manager.leave(tv);
    expect(phone.emit).toHaveBeenCalledWith('room-closed', { reason: 'ended' });
    expect(manager.roomCount).toBe(0);
  });

  it('the phone leaving explicitly frees its slot and invalidates its token', () => {
    const { manager } = makeManager();
    const { tv, phone, phoneToken } = pair(manager);
    manager.leave(phone);
    expect(tv.emit).toHaveBeenCalledWith('peer-left', { role: 'controller', reason: 'left' });
    const again = manager.join(makePeer('phone-2'), controller({ token: phoneToken }));
    expect(again).toMatchObject({ ok: true, snapshot: { resumed: false } });
  });

  it('drops an action silently (no crash) if it arrives while the viewer is mid-reconnect', () => {
    const { manager } = makeManager();
    const { tv, phone } = pair(manager);
    manager.disconnect(tv);
    expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: true });
  });

  it('is a no-op when disconnecting or leaving with a peer that never joined', () => {
    const { manager } = makeManager();
    expect(() => manager.disconnect(makePeer('ghost'))).not.toThrow();
    expect(() => manager.leave(makePeer('ghost'))).not.toThrow();
    expect(manager.roomCount).toBe(0);
  });
});
