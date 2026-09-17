import { describe, it, expect, vi } from 'vitest';
import { SignalingSocket } from './signaling-socket.js';

/** Minimal fake standing in for the socket.io-client Socket this wrapper uses. */
function makeFakeIoSocket() {
  const handlers = new Map();
  const socket = {
    connected: false,
    emitCalls: [],
    connect: vi.fn(() => {
      socket.connected = true;
      handlers.get('connect')?.forEach((h) => h());
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      handlers.get('disconnect')?.forEach((h) => h());
    }),
    emit: vi.fn((event, payload) => socket.emitCalls.push([event, payload])),
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    }),
    trigger(event, payload) {
      handlers.get(event)?.forEach((h) => h(payload));
    },
  };
  return socket;
}

describe('SignalingSocket', () => {
  it('joins the room with its role and session as soon as the socket connects', () => {
    const fake = makeFakeIoSocket();
    const socket = new SignalingSocket({
      role: 'controller',
      session: 'AB23CD45',
      createSocket: () => fake,
    });

    socket.connect();

    expect(fake.emit).toHaveBeenCalledWith('join', { role: 'controller', session: 'AB23CD45' });
  });

  it('re-joins automatically on every reconnect (socket.io fires "connect" again)', () => {
    const fake = makeFakeIoSocket();
    const socket = new SignalingSocket({ role: 'viewer', session: 'AB23CD45', createSocket: () => fake });
    socket.connect();

    fake.trigger('disconnect');
    fake.trigger('connect'); // simulates socket.io's own automatic reconnection

    const joinCalls = fake.emit.mock.calls.filter(([event]) => event === 'join');
    expect(joinCalls).toHaveLength(2);
  });

  it('forwards sendAction as an "action" emit', () => {
    const fake = makeFakeIoSocket();
    const socket = new SignalingSocket({ role: 'controller', session: 'AB23CD45', createSocket: () => fake });

    socket.sendAction({ button: 'jump', pressed: true });

    expect(fake.emit).toHaveBeenCalledWith('action', { button: 'jump', pressed: true });
  });

  it('dispatches "action" messages to onAction listeners', () => {
    const fake = makeFakeIoSocket();
    const socket = new SignalingSocket({ role: 'viewer', session: 'AB23CD45', createSocket: () => fake });
    const onAction = vi.fn();
    socket.onAction(onAction);

    fake.trigger('action', { button: 'jump', pressed: true });

    expect(onAction).toHaveBeenCalledWith({ button: 'jump', pressed: true });
  });

  it('reports connection changes as booleans', () => {
    const fake = makeFakeIoSocket();
    const socket = new SignalingSocket({ role: 'viewer', session: 'AB23CD45', createSocket: () => fake });
    const changes = [];
    socket.onConnectionChange((connected) => changes.push(connected));

    socket.connect();
    fake.trigger('disconnect');

    expect(changes).toEqual([true, false]);
  });

  it('exposes peer-joined, peer-left, room-closed and join-error separately', () => {
    const fake = makeFakeIoSocket();
    const socket = new SignalingSocket({ role: 'viewer', session: 'AB23CD45', createSocket: () => fake });
    const onPeerJoined = vi.fn();
    const onPeerLeft = vi.fn();
    const onRoomClosed = vi.fn();
    const onJoinError = vi.fn();
    socket.onPeerJoined(onPeerJoined);
    socket.onPeerLeft(onPeerLeft);
    socket.onRoomClosed(onRoomClosed);
    socket.onJoinError(onJoinError);

    fake.trigger('peer-joined', { role: 'controller' });
    fake.trigger('peer-left', { role: 'controller' });
    fake.trigger('room-closed');
    fake.trigger('join-error', { error: 'room-full' });

    expect(onPeerJoined).toHaveBeenCalledTimes(1);
    expect(onPeerLeft).toHaveBeenCalledTimes(1);
    expect(onRoomClosed).toHaveBeenCalledTimes(1);
    expect(onJoinError).toHaveBeenCalledWith({ error: 'room-full' });
  });
});
