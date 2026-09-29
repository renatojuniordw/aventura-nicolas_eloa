import { describe, it, expect, vi } from 'vitest';
import { DiagnosticsLog, sanitizeDetail } from './diagnostics-log.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: vi.fn((key, value) => data.set(key, value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

function makeLog(storage, overrides = {}) {
  let n = 0;
  return new DiagnosticsLog({
    role: 'controller',
    build: '0.4.0+abc',
    navigation: 'reload',
    storage,
    now: () => 1_000_000,
    mono: () => (n += 100),
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    randomId: () => `run${Math.random().toString(16).slice(2, 6)}`,
    ...overrides,
  });
}

describe('DiagnosticsLog', () => {
  it('after a reload, the previous run is readable up to its last persisted event', () => {
    const storage = memoryStorage();
    const first = makeLog(storage);
    first.record('join-ok', { resumed: false });
    first.record('visibility-hidden'); // flushes at once
    const second = makeLog(storage);
    expect(second.previous.runId).toBe(first.runId);
    expect(second.previous.events.map((e) => e.type)).toEqual(['run-start', 'join-ok', 'visibility-hidden']);
    expect(second.runId).not.toBe(first.runId);
    expect(second.current.navigation).toBe('reload');
  });

  it('keeps only one earlier run', () => {
    const storage = memoryStorage();
    const a = makeLog(storage);
    a.flush();
    const b = makeLog(storage);
    b.flush();
    const c = makeLog(storage);
    expect(c.previous.runId).toBe(b.runId);
  });

  it('is bounded to the configured number of events', () => {
    const log = makeLog(memoryStorage(), { maxEvents: 5 });
    for (let i = 0; i < 20; i += 1) log.record('tick');
    expect(log.current.events).toHaveLength(5);
    expect(log.current.events.at(-1).seq).toBe(21);
    expect(log.current.dropped).toBeGreaterThan(0);
  });

  it('never stores a session code, token, URL or name', () => {
    expect(sanitizeDetail({ session: 'AB23CD45', token: 'x', pairingUrl: 'http://x', name: 'Nicolas', reason: 'ok' })).toEqual({ reason: 'ok' });
    const storage = memoryStorage();
    const log = makeLog(storage);
    log.record('join-sent', { session: 'AB23CD45', attempt: 1 });
    log.flush();
    expect([...storage.data.values()].join()).not.toContain('AB23CD45');
  });

  it('waits for the periodic save for ordinary events, and saves at once on transitions', () => {
    const storage = memoryStorage();
    const log = makeLog(storage);
    storage.setItem.mockClear();
    log.record('sensor-gap', { ms: 800 });
    expect(storage.setItem).not.toHaveBeenCalled();
    log.record('pagehide', { persisted: false });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('formats a report with both runs and can be cleared', () => {
    const storage = memoryStorage();
    makeLog(storage).record('socket-disconnect', { reason: 'ping timeout' });
    const log = makeLog(storage);
    const report = log.formatReport();
    expect(report).toContain('Execução atual');
    expect(report).toContain('Execução anterior');
    expect(report).toContain('socket-disconnect reason=ping timeout');
    log.clear();
    expect(log.previous).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('works with storage blocked', () => {
    const log = makeLog(null);
    log.record('pagehide');
    expect(log.current.events).toHaveLength(2);
  });

  it('with deferred persistence, writes nothing until enabled, then everything kept so far', () => {
    const storage = memoryStorage();
    const log = makeLog(storage, { deferPersistence: true });
    log.record('visibility-hidden');
    log.record('pagehide');
    expect(storage.setItem).not.toHaveBeenCalled();
    log.enablePersistence();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse([...storage.data.values()][0]).current.events.map((e) => e.type)).toEqual(['run-start', 'visibility-hidden', 'pagehide']);
  });
});
