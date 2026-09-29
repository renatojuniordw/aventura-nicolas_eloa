import { describe, it, expect, vi, afterEach } from 'vitest';
import { SignalingSocket, PROTOCOL_VERSION } from './signaling-socket.js';

/** Minimal fake standing in for the socket.io-client Socket this wrapper uses. */
function makeFakeIoSocket() {
  const handlers = new Map();
  const socket = {
    connected: false,
    sendBuffer: [],
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
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    }),
    off: vi.fn((event, handler) => {
      const list = handlers.get(event);
      if (list) handlers.set(event, list.filter((h) => h !== handler));
    }),
    trigger(event, payload) {
      handlers.get(event)?.forEach((h) => h(payload));
    },
    /** Transport drop as socket.io reports it (no call to disconnect()). */
    drop(reason = 'transport close') {
      socket.connected = false;
      socket.trigger('disconnect', reason);
    },
    reconnect() {
      socket.connected = true;
      socket.trigger('connect');
    },
    handlerCount() {
      return [...handlers.values()].reduce((sum, list) => sum + list.length, 0);
    },
  };
  return socket;
}

function memoryTokens(initial = null) {
  let token = initial;
  return { read: () => token, write: vi.fn((next) => (token = next)) };
}

function makeSocket(options = {}) {
  const fake = makeFakeIoSocket();
  const timers = [];
  let now = 0;
  const tokens = options.tokenStore ?? memoryTokens();
  const socket = new SignalingSocket({
    role: 'controller',
    session: 'AB23CD45',
    createSocket: () => fake,
    tokenStore: tokens,
    setTimeoutFn: (fn, ms) => {
      const timer = { fn, ms, at: now + ms, done: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      if (timer) timer.done = true;
    },
    now: () => now,
    random: () => 0.5,
    ...options,
  });
  const advance = (ms) => {
    now += ms;
    for (const timer of [...timers]) {
      if (!timer.done && timer.at <= now) {
        timer.done = true;
        timer.fn();
      }
    }
  };
  const joins = () => fake.emit.mock.calls.filter(([event]) => event === 'join');
  const confirm = (extra = {}) =>
    fake.trigger('joined', { protocol: PROTOCOL_VERSION, role: 'controller', resumed: false, generation: 1, peers: { viewer: true, controller: true }, token: 'tok-1', ...extra });
  return { fake, socket, advance, joins, confirm, tokens };
}

describe('SignalingSocket: join confirmation', () => {
  it('joins with role, session, protocol and stored token as soon as the socket connects', () => {
    const { fake, socket } = makeSocket({ tokenStore: memoryTokens('saved') });
    socket.connect();
    expect(fake.emit).toHaveBeenCalledWith('join', { role: 'controller', session: 'AB23CD45', token: 'saved', protocol: PROTOCOL_VERSION });
    expect(socket.state).toBe('joining');
    expect(socket.joined).toBe(false);
  });

  it('is joined only after the server confirms, and keeps the resume token', () => {
    const { socket, confirm, tokens } = makeSocket();
    socket.connect();
    confirm();
    expect(socket.state).toBe('joined');
    expect(socket.joined).toBe(true);
    expect(tokens.write).toHaveBeenCalledWith('tok-1');
  });

  it('re-sends an unanswered join with backoff, without needing a new connect', () => {
    const { socket, advance, joins, fake } = makeSocket({ joinTimeoutMs: 4000 });
    socket.connect();
    expect(joins()).toHaveLength(1);
    advance(4000); // join timeout → retry scheduled (1000 * (0.5 + 0.5*0.5) = 750 ms)
    advance(750);
    expect(joins()).toHaveLength(2);
    expect(fake.connect).toHaveBeenCalledTimes(1);
  });

  it('re-joins automatically on every reconnect', () => {
    const { socket, fake, joins, confirm } = makeSocket();
    socket.connect();
    confirm();
    fake.drop();
    expect(socket.state).toBe('connecting');
    fake.reconnect();
    expect(joins()).toHaveLength(2);
  });

  it('connect() on an already connected socket re-sends the join instead of doing nothing', () => {
    const { socket, joins } = makeSocket();
    socket.connect();
    socket.connect();
    expect(joins()).toHaveLength(2);
  });

  it('clears the last error only on a confirmed join', () => {
    const { socket, fake, confirm, advance } = makeSocket();
    socket.connect();
    fake.trigger('join-error', { error: 'room-not-found' });
    expect(socket.lastError).toBe('room-not-found');
    advance(750);
    expect(socket.lastError).toBe('room-not-found');
    confirm();
    expect(socket.lastError).toBeNull();
  });

  it('keeps retrying room-not-found as "waiting-room" for the controller, then gives up', () => {
    const { socket, fake, joins, advance } = makeSocket({ waitForRoomMs: 10_000 });
    const onError = vi.fn();
    socket.onJoinError(onError);
    socket.connect();
    fake.trigger('join-error', { error: 'room-not-found' });
    expect(socket.state).toBe('waiting-room');
    advance(750);
    expect(joins()).toHaveLength(2);
    advance(10_000);
    fake.trigger('join-error', { error: 'room-not-found' });
    expect(socket.state).toBe('rejected');
    expect(socket.closeReason).toBe('room-not-found');
    expect(onError).toHaveBeenCalled();
  });

  it('treats room-full as terminal and stops reconnecting', () => {
    const { socket, fake } = makeSocket();
    socket.connect();
    fake.trigger('join-error', { error: 'room-full' });
    expect(socket.state).toBe('rejected');
    expect(fake.disconnect).toHaveBeenCalled();
    socket.connect();
    expect(fake.connect).toHaveBeenCalledTimes(1);
  });

  it('a socket replaced by a newer one stops and reports it', () => {
    const { socket, fake, confirm } = makeSocket();
    const onClosed = vi.fn();
    socket.onClosed(onClosed);
    socket.connect();
    confirm();
    fake.trigger('session-replaced', { reason: 'replaced' });
    expect(socket.state).toBe('replaced');
    expect(onClosed).toHaveBeenCalledWith({ reason: 'replaced' });
    expect(fake.connected).toBe(false);
  });

  it('a closed room forgets the token and ends the session', () => {
    const { socket, fake, confirm, tokens } = makeSocket();
    socket.connect();
    confirm();
    fake.trigger('room-closed', { reason: 'expired' });
    expect(socket.state).toBe('closed');
    expect(socket.closeReason).toBe('expired');
    expect(tokens.write).toHaveBeenLastCalledWith(null);
  });

  it('leave() tells the server, forgets the token, and closes the socket once acknowledged', () => {
    const { socket, fake, confirm, tokens } = makeSocket();
    socket.connect();
    confirm();
    socket.leave();
    expect(tokens.write).toHaveBeenLastCalledWith(null);
    expect(socket.state).toBe('closed');
    const [, ack] = fake.emit.mock.calls.find(([event]) => event === 'leave');
    expect(fake.connected).toBe(true);
    ack();
    expect(fake.connected).toBe(false);
  });

  it('leave() closes anyway when the acknowledgement never comes, even if disposed meanwhile', () => {
    const { socket, fake, confirm, advance } = makeSocket();
    socket.connect();
    confirm();
    socket.leave();
    socket.dispose();
    expect(fake.connected).toBe(true);
    advance(1000);
    expect(fake.connected).toBe(false);
  });
});

describe('SignalingSocket: ephemeral commands', () => {
  it('sends actions only while joined, numbered', () => {
    const { socket, fake, confirm } = makeSocket();
    socket.connect();
    expect(socket.sendAction({ button: 'jump', pressed: true })).toBe(false);
    confirm();
    expect(socket.sendAction({ button: 'jump', pressed: true })).toBe(true);
    expect(socket.sendAction({ button: 'jump', pressed: true })).toBe(true);
    expect(fake.emit.mock.calls.filter(([event]) => event === 'action')).toEqual([
      ['action', { button: 'jump', pressed: true, seq: 1 }],
      ['action', { button: 'jump', pressed: true, seq: 2 }],
    ]);
  });

  it('never queues jumps made while offline: nothing is sent on reconnect', () => {
    const { socket, fake, confirm } = makeSocket();
    socket.connect();
    confirm();
    fake.drop();
    for (let i = 0; i < 10; i += 1) expect(socket.sendAction({ button: 'jump', pressed: true })).toBe(false);
    fake.reconnect();
    // Still not confirmed after reconnecting: dropped too.
    expect(socket.sendAction({ button: 'jump', pressed: true })).toBe(false);
    confirm();
    expect(fake.emit).not.toHaveBeenCalledWith('action', expect.anything());
  });

  it('purges commands socket.io queued just before a drop, keeping session messages', () => {
    const { socket, fake, confirm } = makeSocket();
    socket.connect();
    confirm();
    fake.sendBuffer.push({ data: ['action', { button: 'jump' }] }, { data: ['health', {}] }, { data: ['leave'] });
    fake.drop('ping timeout');
    expect(fake.sendBuffer).toEqual([{ data: ['leave'] }]);
  });

  it('health beacons follow the same rule', () => {
    const { socket, fake, confirm } = makeSocket();
    socket.connect();
    expect(socket.sendHealth({ sensor: 'ok', visible: true })).toBe(false);
    confirm();
    expect(socket.sendHealth({ sensor: 'ok', visible: true })).toBe(true);
    expect(fake.emit).toHaveBeenCalledWith('health', { sensor: 'ok', visible: true });
  });

  it('delivers actions and health to listeners only while joined', () => {
    const { socket, fake, confirm } = makeSocket({ role: 'viewer' });
    const onAction = vi.fn();
    const onHealth = vi.fn();
    socket.onAction(onAction);
    socket.onPeerHealth(onHealth);
    socket.connect();
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 1 });
    expect(onAction).not.toHaveBeenCalled();
    confirm({ role: 'viewer' });
    fake.trigger('action', { button: 'jump', pressed: true, seq: 1, generation: 1 });
    fake.trigger('peer-health', { sensor: 'ok', visible: true, generation: 1 });
    expect(onAction).toHaveBeenCalledWith({ button: 'jump', pressed: true, seq: 1, generation: 1 });
    expect(onHealth).toHaveBeenCalledTimes(1);
  });
});

describe('SignalingSocket: listeners and lifecycle', () => {
  it('every on* returns its own unsubscribe', () => {
    const { socket, fake, confirm } = makeSocket();
    const onState = vi.fn();
    const off = socket.onStateChange(onState);
    socket.connect();
    off();
    confirm();
    expect(onState.mock.calls.map(([state]) => state)).toEqual(['connecting', 'joining']);
    expect(fake.connected).toBe(true);
  });

  it('dispose() removes every socket.io handler it installed and closes the socket', () => {
    const { socket, fake } = makeSocket();
    expect(fake.handlerCount()).toBeGreaterThan(0);
    socket.dispose();
    expect(fake.handlerCount()).toBe(0);
    expect(fake.connected).toBe(false);
  });

  it('reports connection changes as booleans', () => {
    const { socket, fake } = makeSocket();
    const changes = [];
    socket.onConnectionChange((connected) => changes.push(connected));
    socket.connect();
    fake.drop();
    expect(changes).toEqual([true, false]);
  });

  it('reports presence snapshots and peer-left with its reason', () => {
    const { socket, fake } = makeSocket();
    const onPresence = vi.fn();
    const onPeerLeft = vi.fn();
    socket.onPresence(onPresence);
    socket.onPeerLeft(onPeerLeft);
    fake.trigger('presence', { protocol: 2, role: 'controller', resumed: false, generation: 1, peers: { viewer: false, controller: true } });
    fake.trigger('peer-left', { role: 'viewer', reason: 'dropped' });
    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(socket.snapshot.peers.viewer).toBe(false);
    expect(onPeerLeft).toHaveBeenCalledWith({ role: 'viewer', reason: 'dropped' });
  });

  it('reports diagnostics without the session code or token', () => {
    const events = [];
    const { socket, fake, confirm } = makeSocket({ onDiagnostic: (type, detail) => events.push([type, detail]) });
    socket.connect();
    confirm();
    fake.drop('ping timeout');
    expect(events.map(([type]) => type)).toEqual(['socket-connect', 'join-sent', 'join-ok', 'socket-disconnect']);
    expect(JSON.stringify(events)).not.toMatch(/AB23CD45|tok-1/);
    expect(events.at(-1)[1]).toEqual({ reason: 'ping timeout' });
  });
});

describe('SignalingSocket: measureLatency', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves the round-trip time once the server echoes the same timestamp back', async () => {
    const { socket, fake } = makeSocket();
    socket.connect();
    const promise = socket.measureLatency();
    const [, sentAt] = fake.emit.mock.calls.find(([event]) => event === 'ping-check');
    fake.trigger('pong-check', sentAt);
    expect(await promise).toBeGreaterThanOrEqual(0);
  });

  it('resolves null immediately when the socket is not connected', async () => {
    const { socket, fake } = makeSocket();
    expect(await socket.measureLatency()).toBeNull();
    expect(fake.emit).not.toHaveBeenCalledWith('ping-check', expect.anything());
  });

  it('ignores a stale echo from an earlier measureLatency call', async () => {
    const { socket, fake } = makeSocket();
    socket.connect();
    const first = socket.measureLatency();
    const [, sentAt] = fake.emit.mock.calls.find(([event]) => event === 'ping-check');
    fake.trigger('pong-check', sentAt - 1);
    fake.trigger('pong-check', sentAt);
    expect(await first).toBeGreaterThanOrEqual(0);
  });

  it('resolves null if no reply arrives within the timeout', async () => {
    vi.useFakeTimers();
    const { socket } = makeSocket();
    socket.connect();
    const promise = socket.measureLatency(1000);
    vi.advanceTimersByTime(1000);
    expect(await promise).toBeNull();
  });
});
