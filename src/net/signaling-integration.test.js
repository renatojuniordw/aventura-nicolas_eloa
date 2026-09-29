import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import { createSignalingServer } from '../../signaling/src/server.js';
import { RoomManager } from '../../signaling/src/room-manager.js';
import { SignalingSocket } from './signaling-socket.js';
import { PhoneViewerTransport } from './phone-viewer-transport.js';
import { PhoneControllerTransport } from './phone-controller-transport.js';

/**
 * Real signaling server and real socket.io clients (docs/19 §5): the order of
 * connect/join, socket.io's offline buffer and socket replacement are
 * properties of the transport that the unit fakes cannot show.
 */

const SESSION = 'AB23CD45';
const quiet = () => {};

async function waitFor(predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function memoryTokens() {
  let token = null;
  return { read: () => token, write: (next) => (token = next) };
}

let server;
let url;
const opened = [];

function makeSocket(role, tokenStore = memoryTokens()) {
  let raw;
  const socket = new SignalingSocket({
    url,
    role,
    session: SESSION,
    tokenStore,
    joinTimeoutMs: 1000,
    createSocket: (target) => {
      raw = io(target, { autoConnect: false, transports: ['websocket'], reconnectionDelay: 20, reconnectionDelayMax: 50 });
      return raw;
    },
  });
  opened.push(socket);
  return { socket, raw: () => raw, tokenStore };
}

beforeEach(async () => {
  server = createSignalingServer({ port: 0, rooms: new RoomManager({ log: quiet }) });
  const address = await new Promise((resolve) => server.listen(resolve));
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const socket of opened.splice(0)) socket.dispose();
  await server.close();
});

describe('signaling over real socket.io', () => {
  it('pairs, confirms both joins and delivers back-to-back jumps and beacons, each once', async () => {
    const tv = makeSocket('viewer');
    const viewer = new PhoneViewerTransport(SESSION, { socket: tv.socket });
    const received = [];
    viewer.onMessage((payload) => received.push(payload));
    viewer.connect();
    await waitFor(() => viewer.link.joined);

    const phone = new PhoneControllerTransport(SESSION, { socket: makeSocket('controller').socket });
    phone.connect();
    await waitFor(() => phone.viewerPresent && viewer.link.controllerPresent);

    expect(phone.sendJump()).toBe(true);
    expect(phone.sendJump()).toBe(true);
    phone.sendHealth({ sensor: 'ok', visible: true });
    await waitFor(() => received.length === 2 && viewer.link.lastHealth);
    await sleep(50);
    expect(received).toEqual([{ button: 'jump', pressed: true }, { button: 'jump', pressed: true }]);
    expect(viewer.link.lastHealth).toMatchObject({ sensor: 'ok', visible: true });
  });

  it('a join retried on the same socket (lost confirmation) keeps generation and credential', async () => {
    const tv = makeSocket('viewer');
    const viewer = new PhoneViewerTransport(SESSION, { socket: tv.socket });
    viewer.connect();
    await waitFor(() => viewer.link.joined);
    const phone = makeSocket('controller');
    phone.socket.connect();
    await waitFor(() => phone.socket.joined && viewer.link.controllerPresent);
    const { generation } = phone.socket.snapshot;
    const token = phone.tokenStore.read();

    phone.socket.rejoin();
    await sleep(100);
    expect(phone.socket.snapshot.generation).toBe(generation);
    expect(phone.tokenStore.read()).toBe(token);
    expect(viewer.link.generation).toBe(generation);
  });

  it('a jump made before the match armed is dropped even when it arrives on time', async () => {
    const tv = makeSocket('viewer');
    const viewer = new PhoneViewerTransport(SESSION, { socket: tv.socket });
    const received = [];
    viewer.onMessage((payload) => received.push(payload));
    viewer.connect();
    await waitFor(() => viewer.link.joined);
    const phone = new PhoneControllerTransport(SESSION, { socket: makeSocket('controller').socket });
    phone.connect();
    await waitFor(() => phone.viewerPresent && viewer.link.controllerPresent);
    phone.sendHealth({ sensor: 'ok', visible: true });
    await waitFor(() => viewer.link.lastHealth);

    // Same process, same clock: arming 200 ms ahead makes a jump sent now "before arming".
    viewer.armAt(performance.now() + 200);
    phone.sendJump();
    await sleep(100);
    expect(received).toEqual([]);
    await sleep(150);
    phone.sendJump();
    await waitFor(() => received.length === 1);
  });

  it('keeps a second phone out with room-full', async () => {
    const viewer = makeSocket('viewer').socket;
    viewer.connect();
    await waitFor(() => viewer.joined);
    const first = makeSocket('controller').socket;
    first.connect();
    await waitFor(() => first.joined);

    const intruder = makeSocket('controller').socket;
    intruder.connect();
    await waitFor(() => intruder.state === 'rejected');
    expect(intruder.lastError).toBe('room-full');
    expect(first.joined).toBe(true);
  });

  it('a reloaded controller (new socket, same tab token) replaces the old one while it is still connected', async () => {
    const tv = makeSocket('viewer');
    const viewer = new PhoneViewerTransport(SESSION, { socket: tv.socket });
    const received = [];
    viewer.onMessage((payload) => received.push(payload));
    viewer.connect();
    await waitFor(() => viewer.link.joined);

    const tabTokens = memoryTokens();
    const before = makeSocket('controller', tabTokens).socket;
    before.connect();
    await waitFor(() => before.joined);

    const after = makeSocket('controller', tabTokens).socket;
    after.connect();
    await waitFor(() => after.joined && before.state === 'replaced');
    expect(after.snapshot.resumed).toBe(true);

    // The old socket is gone for good: no reconnect fight, no late effect on the new one.
    await sleep(150);
    expect(before.connected).toBe(false);
    expect(after.joined).toBe(true);
    expect(viewer.link.controllerPresent).toBe(true);

    after.sendAction({ button: 'jump', pressed: true });
    await waitFor(() => received.length === 1);
  });

  it('jumps made while offline are never delivered after the reconnect', async () => {
    const tv = makeSocket('viewer');
    const viewer = new PhoneViewerTransport(SESSION, { socket: tv.socket });
    const received = [];
    viewer.onMessage((payload) => received.push(payload));
    viewer.connect();
    await waitFor(() => viewer.link.joined);

    const phoneSide = makeSocket('controller');
    const phone = phoneSide.socket;
    phone.connect();
    await waitFor(() => phone.joined && viewer.link.controllerPresent);

    // Network drop on the phone: socket.io reconnects on its own.
    phoneSide.raw().io.engine.close();
    await waitFor(() => !phone.connected);
    const sentWhileOffline = Array.from({ length: 10 }, () => phone.sendAction({ button: 'jump', pressed: true }));
    expect(sentWhileOffline.every((sent) => sent === false)).toBe(true);
    // A packet still queued at reconnect is flushed before the new join: the server ignores it.
    phoneSide.raw().sendBuffer.push({ type: 2, data: ['action', { button: 'jump', pressed: true, seq: 999 }], options: {}, nsp: '/' });

    await waitFor(() => phone.joined && viewer.link.controllerPresent, 5000);
    await sleep(100);
    expect(received).toEqual([]);

    // Only a new gesture after the recovery goes through.
    expect(phone.sendAction({ button: 'jump', pressed: true })).toBe(true);
    await waitFor(() => received.length === 1);
  });

  it('the viewer dropping and coming back is seen by the phone, with the same session', async () => {
    const tvSide = makeSocket('viewer');
    const tv = tvSide.socket;
    tv.connect();
    await waitFor(() => tv.joined);

    const phone = new PhoneControllerTransport(SESSION, { socket: makeSocket('controller').socket });
    phone.connect();
    await waitFor(() => phone.viewerPresent);

    tvSide.raw().io.engine.close();
    await waitFor(() => !phone.viewerPresent);
    await waitFor(() => tv.joined && phone.viewerPresent, 5000);
    expect(tv.snapshot.resumed).toBe(true);
    expect(phone.joined).toBe(true);
  });

  it('the TV ending the session tells the phone at once', async () => {
    const tv = makeSocket('viewer').socket;
    tv.connect();
    await waitFor(() => tv.joined);
    const phone = makeSocket('controller').socket;
    phone.connect();
    await waitFor(() => phone.joined);

    tv.leave();
    await waitFor(() => phone.state === 'closed');
    expect(phone.closeReason).toBe('ended');
  });
});
