import { describe, it, expect, vi } from 'vitest';
import { PhoneViewerTransport } from './phone-viewer-transport.js';
import { SignalingSocket, PROTOCOL_VERSION } from './signaling-socket.js';

function makeFakeIoSocket() {
  const handlers = new Map();
  const socket = {
    connected: false,
    connect: vi.fn(() => {
      socket.connected = true;
      socket.trigger('connect');
    }),
    disconnect: vi.fn(() => {
      if (!socket.connected) return;
      socket.connected = false;
      socket.trigger('disconnect', 'io client disconnect');
    }),
    emit: vi.fn(),
    on: (event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    },
    off: (event, handler) => handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== handler)),
    trigger(event, payload) {
      handlers.get(event)?.forEach((h) => h(payload));
    },
  };
  return socket;
}

const snapshot = (peers, generation = 1) => ({ protocol: PROTOCOL_VERSION, role: 'viewer', resumed: false, generation, peers });

function setup() {
  const fake = makeFakeIoSocket();
  let now = 0;
  const socket = new SignalingSocket({
    role: 'viewer',
    session: 'AB23CD45',
    createSocket: () => fake,
    tokenStore: { read: () => null, write: () => {} },
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  });
  const transport = new PhoneViewerTransport('AB23CD45', { socket, now: () => now });
  transport.connect();
  return { fake, transport, setNow: (t) => (now = t) };
}

describe('PhoneViewerTransport', () => {
  it('tracks presence from snapshots and remembers that a phone paired once', () => {
    const { fake, transport } = setup();
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: false }), token: 't' });
    expect(transport.link).toMatchObject({ joined: true, controllerPresent: false, everPaired: false });
    fake.trigger('presence', snapshot({ viewer: true, controller: true }));
    expect(transport.link).toMatchObject({ controllerPresent: true, everPaired: true });
    fake.trigger('peer-left', { role: 'controller', reason: 'dropped' });
    expect(transport.link).toMatchObject({ controllerPresent: false, everPaired: true });
  });

  it('times beacons with its own clock and forgets them when the phone presence changes', () => {
    const { fake, transport, setNow } = setup();
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    setNow(500);
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 1 });
    expect(transport.link.lastHealth).toMatchObject({ sensor: 'ok', receivedAt: 500 });
    fake.trigger('peer-left', { role: 'controller', reason: 'dropped' });
    expect(transport.link.lastHealth).toBeNull();
  });

  it('a replaced phone connection (no peer-left in between) starts without health', () => {
    const { fake, transport, setNow } = setup();
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    setNow(500);
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 1 });
    setNow(700);
    // Authenticated replacement of a live socket: presence never goes false.
    fake.trigger('presence', snapshot({ viewer: true, controller: true }, 2));
    expect(transport.link).toMatchObject({ generation: 2, lastHealth: null, controllerSince: 700, controllerPresent: true });
    // A late beacon from the replaced connection does not count.
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 1 });
    expect(transport.link.lastHealth).toBeNull();
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 2 });
    expect(transport.link.lastHealth).toMatchObject({ generation: 2, receivedAt: 700 });
  });

  it('a beacon that overtakes its presence snapshot moves to the new connection at once', () => {
    const { fake, transport, setNow } = setup();
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 1 });
    setNow(300);
    fake.trigger('peer-health', { sensor: 'stale', visible: true, generation: 2 });
    expect(transport.link).toMatchObject({ generation: 2, lastHealth: { sensor: 'stale', generation: 2 } });
  });

  it('drops a command delayed in transit on the same connection, and those sent before arming', () => {
    const { fake, transport, setNow } = setup();
    const received = vi.fn();
    transport.onMessage(received);
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    setNow(1040);
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 1, sentAt: 1000 });
    setNow(2050);
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 1, sentAt: 2000 });
    setNow(5000);
    fake.trigger('action', { button: 'jump', pressed: true, seq: 2, generation: 1, sentAt: 2100 });
    expect(received).toHaveBeenCalledTimes(1);
    transport.armAt(6000);
    setNow(6010);
    fake.trigger('action', { button: 'jump', pressed: true, seq: 3, generation: 1, sentAt: 5900 });
    fake.trigger('action', { button: 'jump', pressed: true, seq: 4, generation: 1, sentAt: 5970 });
    expect(received).toHaveBeenCalledTimes(2);
  });

  it('its own disconnect makes the phone presence unknown', () => {
    const { fake, transport } = setup();
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    fake.connected = false;
    fake.trigger('disconnect', 'transport close');
    expect(transport.link).toMatchObject({ joined: false, controllerPresent: false, state: 'connecting' });
  });

  it('passes on fresh commands only: older generations and duplicates are dropped', () => {
    const { fake, transport } = setup();
    const received = vi.fn();
    transport.onMessage(received);
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }, 2), token: 't' });
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 1 });
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 2 });
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 2 });
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith({ button: 'jump', pressed: true });
  });

  it('onMessage returns an unsubscribe', () => {
    const { fake, transport } = setup();
    const received = vi.fn();
    const off = transport.onMessage(received);
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    off();
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 1 });
    expect(received).not.toHaveBeenCalled();
  });

  it('reports the end of the session with its reason', () => {
    const { fake, transport } = setup();
    const onLink = vi.fn();
    transport.onLinkChange(onLink);
    fake.trigger('joined', { ...snapshot({ viewer: true, controller: true }), token: 't' });
    fake.trigger('room-closed', { reason: 'expired' });
    expect(transport.link).toMatchObject({ state: 'closed', closeReason: 'expired' });
    expect(onLink).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'closed' }));
  });
});
