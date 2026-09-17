import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from './room-manager.js';

const SESSION = 'AB23CD45';
const OTHER_SESSION = 'ZZ99YY88';

function makePeer(id) {
  return { id, emit: vi.fn() };
}

function makeManager(overrides = {}) {
  let time = 0;
  const timers = new Map();
  let nextTimerId = 1;
  return {
    manager: new RoomManager({
      now: () => time,
      setTimeoutFn: (fn) => {
        const id = nextTimerId++;
        timers.set(id, fn);
        return id;
      },
      clearTimeoutFn: (id) => timers.delete(id),
      ...overrides,
    }),
    advance(ms) {
      time += ms;
    },
    fireTimer(id) {
      timers.get(id)?.();
      timers.delete(id);
    },
    timers,
  };
}

describe('RoomManager: pairing', () => {
  it('lets a viewer create a room and a controller join it', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');

    expect(manager.join(tv, { role: 'viewer', session: SESSION })).toEqual({ ok: true });
    expect(manager.join(phone, { role: 'controller', session: SESSION })).toEqual({ ok: true });

    expect(tv.emit).toHaveBeenCalledWith('peer-joined', { role: 'controller' });
  });

  it('rejects a controller for a session with no viewer', () => {
    const { manager } = makeManager();
    const phone = makePeer('phone-1');

    expect(manager.join(phone, { role: 'controller', session: SESSION })).toEqual({
      ok: false,
      error: 'room-not-found',
    });
  });

  it('rejects a second, different controller for an already-paired room', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phoneA = makePeer('phone-a');
    const phoneB = makePeer('phone-b');

    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phoneA, { role: 'controller', session: SESSION });

    expect(manager.join(phoneB, { role: 'controller', session: SESSION })).toEqual({
      ok: false,
      error: 'room-full',
    });
  });

  it('allows the same controller to rejoin (reconnect) without being rejected', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');

    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    expect(manager.join(phone, { role: 'controller', session: SESSION })).toEqual({ ok: true });
  });

  it('rejects malformed session ids and unknown roles', () => {
    const { manager } = makeManager();
    const peer = makePeer('p-1');

    expect(manager.join(peer, { role: 'viewer', session: 'short' })).toEqual({
      ok: false,
      error: 'invalid-session',
    });
    expect(manager.join(peer, { role: 'referee', session: SESSION })).toEqual({
      ok: false,
      error: 'invalid-role',
    });
  });

  it('keeps two sessions fully isolated from each other', () => {
    const { manager } = makeManager();
    const tvA = makePeer('tv-a');
    const tvB = makePeer('tv-b');
    const phoneA = makePeer('phone-a');

    manager.join(tvA, { role: 'viewer', session: SESSION });
    manager.join(tvB, { role: 'viewer', session: OTHER_SESSION });
    manager.join(phoneA, { role: 'controller', session: SESSION });

    manager.action(phoneA, { button: 'jump', pressed: true });

    expect(tvA.emit).toHaveBeenCalledWith('action', { button: 'jump', pressed: true });
    expect(tvB.emit).not.toHaveBeenCalledWith('action', expect.anything());
  });
});

describe('RoomManager: action forwarding', () => {
  it('forwards a controller action only to the viewer of the same room', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    const result = manager.action(phone, { button: 'jump', pressed: true });

    expect(result).toEqual({ ok: true });
    expect(tv.emit).toHaveBeenCalledWith('action', { button: 'jump', pressed: true });
  });

  it('never lets a viewer emit an action (transport never decides game rules)', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    manager.join(tv, { role: 'viewer', session: SESSION });

    expect(manager.action(tv, { button: 'jump', pressed: true })).toEqual({
      ok: false,
      error: 'not-a-controller',
    });
  });

  it('rejects a malformed action payload', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    expect(manager.action(phone, { button: 'jump' })).toEqual({ ok: false, error: 'invalid-payload' });
    expect(manager.action(phone, { pressed: true })).toEqual({ ok: false, error: 'invalid-payload' });
    expect(tv.emit).not.toHaveBeenCalledWith('action', expect.anything());
  });

  it('rate-limits a controller sending too many actions per second', () => {
    const { manager, advance } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    for (let i = 0; i < 10; i += 1) {
      expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: true });
    }
    expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({
      ok: false,
      error: 'rate-limited',
    });

    advance(1001);
    expect(manager.action(phone, { button: 'jump', pressed: true })).toEqual({ ok: true });
  });
});

describe('RoomManager: disconnects and lifecycle', () => {
  it('destroys the room immediately when the viewer disconnects', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    manager.disconnect(tv);

    expect(phone.emit).toHaveBeenCalledWith('room-closed');
    expect(manager.roomCount).toBe(0);
  });

  it('notifies the viewer and keeps the room alive when the controller disconnects', () => {
    const { manager } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    manager.disconnect(phone);

    expect(tv.emit).toHaveBeenCalledWith('peer-left', { role: 'controller' });
    expect(manager.roomCount).toBe(1);
  });

  it('lets the same phone reconnect after a drop, cancelling the expiry', () => {
    const { manager, fireTimer, timers } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    manager.disconnect(phone);
    const timerId = [...timers.keys()][0];
    manager.join(phone, { role: 'controller', session: SESSION });

    // reconnect must have cancelled the pending expiry
    expect(timers.has(timerId)).toBe(false);
    fireTimer(timerId); // no-op: already cancelled
    expect(manager.roomCount).toBe(1);
  });

  it('expires an abandoned room once the TTL elapses with no controller', () => {
    const { manager, timers, fireTimer } = makeManager();
    const tv = makePeer('tv-1');
    const phone = makePeer('phone-1');
    manager.join(tv, { role: 'viewer', session: SESSION });
    manager.join(phone, { role: 'controller', session: SESSION });

    manager.disconnect(phone);
    expect(manager.roomCount).toBe(1);

    const [timerId] = [...timers.keys()];
    fireTimer(timerId);

    expect(manager.roomCount).toBe(0);
  });

  it('is a no-op when disconnecting a peer that never joined', () => {
    const { manager } = makeManager();
    expect(() => manager.disconnect(makePeer('ghost'))).not.toThrow();
    expect(manager.roomCount).toBe(0);
  });
});
