import { describe, it, expect, vi } from 'vitest';
import { WakeLockKeeper, WAKE_LOCK_MAX_FAILURES } from './wake-lock-keeper.js';

function makeDoc(visibilityState = 'visible') {
  const listeners = new Set();
  return {
    visibilityState,
    addEventListener: vi.fn((type, fn) => listeners.add(fn)),
    removeEventListener: vi.fn((type, fn) => listeners.delete(fn)),
    set(state) {
      this.visibilityState = state;
      for (const fn of [...listeners]) fn();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function makeSentinel() {
  const listeners = new Set();
  return {
    release: vi.fn(async () => {}),
    addEventListener: vi.fn((type, fn) => listeners.add(fn)),
    removeEventListener: vi.fn((type, fn) => listeners.delete(fn)),
    fireRelease() {
      for (const fn of [...listeners]) fn();
    },
  };
}

function makeApi() {
  const sentinels = [];
  const pending = [];
  return {
    sentinels,
    pending,
    request: vi.fn(() => new Promise((resolve, reject) => pending.push({ resolve, reject }))),
    /** Resolves the oldest pending request with a fresh sentinel. */
    async grant() {
      const sentinel = makeSentinel();
      sentinels.push(sentinel);
      pending.shift().resolve(sentinel);
      await Promise.resolve();
      await Promise.resolve();
      return sentinel;
    },
    async refuse() {
      pending.shift().reject(new Error('NotAllowedError'));
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

describe('WakeLockKeeper', () => {
  it('is "unavailable" where the API does not exist, and says so without throwing', async () => {
    const keeper = new WakeLockKeeper({ wakeLock: null, doc: makeDoc() });
    await keeper.start();
    expect(keeper.state).toBe('unavailable');
    expect(keeper.active).toBe(false);
  });

  it('goes requesting → active only once a lock is actually granted', async () => {
    const api = makeApi();
    const states = [];
    const keeper = new WakeLockKeeper({ wakeLock: api, doc: makeDoc(), onChange: (s) => states.push(s) });
    const started = keeper.start();
    expect(keeper.state).toBe('requesting');
    await api.grant();
    await started;
    expect(states).toEqual(['requesting', 'active']);
  });

  it('concurrent starts share a single request', async () => {
    const api = makeApi();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc: makeDoc() });
    keeper.start();
    keeper.start();
    keeper.start();
    expect(api.request).toHaveBeenCalledTimes(1);
    await api.grant();
    keeper.start();
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it('a refusal is "error", retried on the next visibility, and never loops', async () => {
    const api = makeApi();
    const doc = makeDoc();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc });
    keeper.start();
    await api.refuse();
    expect(keeper.state).toBe('error');
    expect(api.request).toHaveBeenCalledTimes(1);
    doc.set('hidden');
    doc.set('visible');
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it('stops asking after the maximum of consecutive failures without a visibility change', async () => {
    const api = makeApi();
    const doc = makeDoc();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc });
    const sentinel = keeper.start();
    await api.grant();
    await sentinel;
    // System keeps releasing, request keeps failing.
    for (let i = 0; i < WAKE_LOCK_MAX_FAILURES + 2; i += 1) {
      api.sentinels.at(-1)?.fireRelease();
      if (api.pending.length) await api.refuse();
    }
    expect(api.request.mock.calls.length).toBeLessThanOrEqual(1 + WAKE_LOCK_MAX_FAILURES);
  });

  it('re-acquires after a release while visible, and marks "released" in between', async () => {
    const api = makeApi();
    const states = [];
    const keeper = new WakeLockKeeper({ wakeLock: api, doc: makeDoc(), onChange: (s) => states.push(s) });
    keeper.start();
    const first = await api.grant();
    first.fireRelease();
    expect(states).toContain('released');
    expect(api.request).toHaveBeenCalledTimes(2);
    await api.grant();
    expect(keeper.state).toBe('active');
  });

  it('released while hidden waits for visibility before asking again', async () => {
    const api = makeApi();
    const doc = makeDoc();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc });
    keeper.start();
    const first = await api.grant();
    doc.visibilityState = 'hidden';
    first.fireRelease();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(keeper.state).toBe('released');
    doc.set('visible');
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it('a lock that arrives after stop() is released at once', async () => {
    const api = makeApi();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc: makeDoc() });
    keeper.start();
    keeper.stop();
    const late = await api.grant();
    await flush();
    expect(late.release).toHaveBeenCalled();
    expect(keeper.active).toBe(false);
  });

  it('dispose() releases and removes its listeners', async () => {
    const api = makeApi();
    const doc = makeDoc();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc });
    keeper.start();
    const sentinel = await api.grant();
    keeper.dispose();
    expect(sentinel.release).toHaveBeenCalled();
    expect(sentinel.removeEventListener).toHaveBeenCalled();
    expect(doc.listenerCount).toBe(0);
    doc.set('visible');
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it('20 start/stop cycles keep at most one live lock', async () => {
    const api = makeApi();
    const keeper = new WakeLockKeeper({ wakeLock: api, doc: makeDoc() });
    for (let i = 0; i < 20; i += 1) {
      keeper.start();
      if (api.pending.length) await api.grant();
      keeper.stop();
    }
    keeper.start();
    await api.grant();
    const live = api.sentinels.filter((s) => s.release.mock.calls.length === 0);
    expect(live).toHaveLength(1);
  });
});
