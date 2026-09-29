import { describe, it, expect, vi } from 'vitest';
import { PhoneControlCoordinator, evaluatePhoneLink, HEALTH_TIMEOUT_MS } from './phone-control-coordinator.js';
import { EventBus, Events } from '../core/event-bus.js';
import { InputManager } from '../input/input-manager.js';
import { Actions } from '../input/actions.js';
import { InputAdapter } from '../input/input-adapter.js';

const baseLink = {
  state: 'joined',
  joined: true,
  controllerPresent: true,
  everPaired: true,
  lastHealth: { sensor: 'ok', visible: true, generation: 1, receivedAt: 0 },
  controllerSince: 0,
  closeReason: null,
  lastError: null,
};

/** Fake viewer transport: link state and messages are pushed by hand. */
function makeFakeTransport() {
  const linkListeners = new Set();
  const messageListeners = new Set();
  const transport = {
    link: { ...baseLink, state: 'joining', joined: false, controllerPresent: false, everPaired: false, lastHealth: null, controllerSince: null },
    leave: vi.fn(),
    dispose: vi.fn(),
    measureLatency: vi.fn(() => Promise.resolve(12)),
    onLinkChange: vi.fn((listener) => {
      linkListeners.add(listener);
      return () => linkListeners.delete(listener);
    }),
    onMessage: vi.fn((listener) => {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    }),
    setLink(patch) {
      transport.link = { ...transport.link, ...patch };
      for (const listener of [...linkListeners]) listener(transport.link);
    },
    send(payload) {
      for (const listener of [...messageListeners]) listener(payload);
    },
    get messageListenerCount() {
      return messageListeners.size;
    },
  };
  return transport;
}

function setup() {
  let now = 0;
  let tick = null;
  const bus = new EventBus();
  const input = new InputManager();
  // Like main.ts: installing keyboard/touch disposes the phone adapters.
  const restoreDefaultInput = vi.fn(() => input.setAdapter(new InputAdapter(input.handleAction)));
  const transports = [];
  const startSession = vi.fn(() => {
    const transport = makeFakeTransport();
    transports.push(transport);
    return { session: 'AB23CD45', pairingUrl: 'http://x/controle?session=AB23CD45', transport };
  });
  const coordinator = new PhoneControlCoordinator({
    input,
    bus,
    restoreDefaultInput,
    startSession,
    now: () => now,
    setIntervalFn: (fn) => {
      tick = fn;
      return 1;
    },
    clearIntervalFn: () => {
      tick = null;
    },
  });
  const blurred = vi.fn();
  bus.on(Events.APP_BLURRED, blurred);
  const pair = () => {
    coordinator.start();
    transports.at(-1).setLink({ ...baseLink, lastHealth: { ...baseLink.lastHealth, receivedAt: now } });
    return transports.at(-1);
  };
  return {
    bus,
    input,
    coordinator,
    restoreDefaultInput,
    startSession,
    transports,
    blurred,
    pair,
    advance(ms) {
      now += ms;
      tick?.();
    },
    get now() {
      return now;
    },
  };
}

describe('evaluatePhoneLink', () => {
  it('is operational only with the room joined, the phone present and a fresh healthy beacon', () => {
    expect(evaluatePhoneLink(baseLink, 100)).toMatchObject({ operational: true, reason: 'ok', paired: true });
  });

  it.each([
    [{ state: 'connecting', joined: false }, 'reconnecting'],
    [{ everPaired: false, controllerPresent: false, lastHealth: null }, 'waiting-phone'],
    [{ controllerPresent: false }, 'phone-reconnecting'],
    [{ lastHealth: { ...baseLink.lastHealth, visible: false } }, 'phone-hidden'],
    [{ lastHealth: { ...baseLink.lastHealth, sensor: 'stale' } }, 'sensor'],
    [{ state: 'closed', closeReason: 'expired' }, 'ended'],
    [{ state: 'replaced', closeReason: 'replaced' }, 'ended'],
  ])('%o → %s', (patch, reason) => {
    const status = evaluatePhoneLink({ ...baseLink, ...patch }, 100);
    expect(status.reason).toBe(reason);
    expect(status.operational).toBe(false);
  });

  it('gives a newly present phone time for its first beacon, then calls it unresponsive', () => {
    const link = { ...baseLink, lastHealth: null, controllerSince: 0 };
    expect(evaluatePhoneLink(link, HEALTH_TIMEOUT_MS - 1).reason).toBe('checking');
    expect(evaluatePhoneLink(link, HEALTH_TIMEOUT_MS).reason).toBe('no-response');
  });

  it('a beacon older than the timeout is no health at all', () => {
    expect(evaluatePhoneLink(baseLink, HEALTH_TIMEOUT_MS + 1).reason).toBe('no-response');
  });

  it('explains why an ended session ended', () => {
    expect(evaluatePhoneLink({ ...baseLink, state: 'closed', closeReason: 'expired' }, 0).message).toMatch(/expirou/);
    expect(evaluatePhoneLink({ ...baseLink, state: 'rejected', closeReason: 'version-mismatch' }, 0).message).toMatch(/versões/);
  });
});

describe('PhoneControlCoordinator', () => {
  it('exposes the pairing details and stays inactive until the phone pairs', () => {
    const { coordinator } = setup();
    const result = coordinator.start();
    expect(result.session).toBe('AB23CD45');
    expect(result.pairingUrl).toContain('session=AB23CD45');
    expect(coordinator.isActive).toBe(false);
    expect(coordinator.status.reason).toBe('reconnecting');
  });

  it('pairing alone does not take over input: only engage() (entering a match) does', () => {
    const { coordinator, pair, input } = setup();
    const setAdapter = vi.spyOn(input, 'setAdapter');
    pair();
    expect(coordinator.isActive).toBe(true);
    expect(setAdapter).not.toHaveBeenCalled();
    expect(coordinator.engage()).toBe(true);
    expect(coordinator.engage()).toBe(true); // idempotent
    expect(setAdapter).toHaveBeenCalledTimes(1);
  });

  it('engage() refuses without a paired phone', () => {
    const { coordinator } = setup();
    coordinator.start();
    expect(coordinator.engage()).toBe(false);
    expect(coordinator.isEngaged).toBe(false);
  });

  it('pauses the match once when the paired phone drops', () => {
    const { coordinator, pair, blurred } = setup();
    const transport = pair();
    coordinator.engage();
    transport.setLink({ controllerPresent: false });
    transport.setLink({ controllerPresent: false });
    expect(blurred).toHaveBeenCalledTimes(1);
    expect(coordinator.canPlay).toBe(false);
  });

  it('pauses when the beacons stop even though every socket is still connected', () => {
    const { coordinator, pair, blurred, advance } = setup();
    pair();
    coordinator.engage();
    advance(HEALTH_TIMEOUT_MS - 500);
    expect(blurred).not.toHaveBeenCalled();
    advance(1000);
    expect(blurred).toHaveBeenCalledTimes(1);
    expect(coordinator.status.reason).toBe('no-response');
  });

  it("pauses at once when this device's own connection drops", () => {
    const { coordinator, pair, blurred } = setup();
    const transport = pair();
    coordinator.engage();
    transport.setLink({ state: 'connecting', joined: false });
    expect(blurred).toHaveBeenCalledTimes(1);
    expect(coordinator.status.reason).toBe('reconnecting');
  });

  it('does not pause outside a match (menu), where nothing runs', () => {
    const { pair, blurred } = setup();
    const transport = pair();
    transport.setLink({ controllerPresent: false });
    expect(blurred).not.toHaveBeenCalled();
  });

  it('drops remote jumps unless engaged and operational — a recovered link does not replay old ones', () => {
    const { coordinator, pair, input, advance } = setup();
    const transport = pair();

    transport.send({ button: 'jump', pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(false); // not in a match

    coordinator.engage();
    transport.send({ button: 'jump', pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(true);

    transport.setLink({ lastHealth: { ...transport.link.lastHealth, sensor: 'stale' } });
    transport.send({ button: 'jump', pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(false);

    advance(10);
    transport.setLink({ lastHealth: { sensor: 'ok', visible: true, generation: 1, receivedAt: 10 } });
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
    transport.send({ button: 'jump', pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(true);
  });

  it('losing health clears held input so the character does not keep running', () => {
    const { coordinator, pair, input } = setup();
    const transport = pair();
    coordinator.engage();
    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(true);
    transport.setLink({ controllerPresent: false });
    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(false);
  });

  it('disengage() (menu) restores keyboard/touch but keeps the pairing', () => {
    const { coordinator, pair, restoreDefaultInput, transports } = setup();
    pair();
    coordinator.engage();
    coordinator.disengage();
    expect(restoreDefaultInput).toHaveBeenCalledTimes(1);
    expect(coordinator.isActive).toBe(true);
    expect(transports[0].leave).not.toHaveBeenCalled();
    expect(transports[0].messageListenerCount).toBe(0);
    // Next match: same phone, no new QR.
    expect(coordinator.engage()).toBe(true);
  });

  it('three matches in a row with menu stops in between keep one session', () => {
    const { coordinator, pair, startSession } = setup();
    pair();
    for (let i = 0; i < 3; i += 1) {
      coordinator.engage();
      coordinator.disengage();
    }
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(coordinator.isActive).toBe(true);
  });

  it('stop() ends the session explicitly and restores keyboard/touch', () => {
    const { coordinator, pair, restoreDefaultInput, transports } = setup();
    pair();
    coordinator.engage();
    coordinator.stop();
    expect(transports[0].leave).toHaveBeenCalledTimes(1);
    expect(transports[0].dispose).toHaveBeenCalledTimes(1);
    expect(restoreDefaultInput).toHaveBeenCalledTimes(1);
    expect(coordinator.isActive).toBe(false);
    expect(coordinator.status.reason).toBe('off');
  });

  it('does not touch the input when stopped without ever engaging', () => {
    const { coordinator, restoreDefaultInput } = setup();
    coordinator.start();
    coordinator.stop();
    expect(restoreDefaultInput).not.toHaveBeenCalled();
  });

  it('starting again closes the previous session first', () => {
    const { coordinator, transports } = setup();
    coordinator.start();
    coordinator.start();
    expect(transports[0].leave).toHaveBeenCalledTimes(1);
    expect(transports).toHaveLength(2);
  });

  it('an ended session stays visible in a match, and is cleaned up once the match is left', () => {
    const { coordinator, pair, transports } = setup();
    const transport = pair();
    coordinator.engage();
    transport.setLink({ state: 'closed', closeReason: 'expired' });
    expect(coordinator.status.reason).toBe('ended');
    expect(coordinator.isActive).toBe(true); // the pause screen can still offer "Desativar"
    coordinator.disengage();
    expect(transports[0].dispose).toHaveBeenCalled();
    expect(coordinator.status.reason).toBe('off');
  });

  it('an ended session outside a match is cleaned up at once', () => {
    const { coordinator, pair } = setup();
    const transport = pair();
    const seen = [];
    coordinator.onStatusChange((status) => seen.push(status.reason));
    transport.setLink({ state: 'closed', closeReason: 'expired' });
    expect(seen).toEqual(['ended', 'off']);
    expect(coordinator.pairing).toBeNull();
  });

  it('announces link changes on the bus (pause screen, update gate)', () => {
    const { bus, coordinator } = setup();
    const changed = vi.fn();
    bus.on(Events.PHONE_LINK_CHANGED, changed);
    coordinator.start();
    expect(changed).toHaveBeenLastCalledWith({ session: true, paired: false, operational: false });
  });

  it('20 start/stop cycles leave no link listener or ticker behind', () => {
    const { coordinator, transports, advance } = setup();
    for (let i = 0; i < 20; i += 1) {
      coordinator.start();
      coordinator.stop();
    }
    expect(transports.every((t) => t.dispose.mock.calls.length === 1)).toBe(true);
    const listener = vi.fn();
    coordinator.onStatusChange(listener);
    advance(10_000);
    expect(listener).not.toHaveBeenCalled();
  });
});
