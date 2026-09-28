import { describe, expect, it, vi } from 'vitest';
import { createMotionPolicy } from './motion-policy.js';

function fakeMedia(matches) {
  const listeners = new Set();
  return {
    matches,
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    set(value) { this.matches = value; for (const fn of listeners) fn(); },
    listeners,
  };
}

function fakeGame(value) {
  const listeners = new Set();
  return {
    value,
    read: () => value,
    set(next) { value = next; for (const fn of listeners) fn(); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    listeners,
  };
}

describe('createMotionPolicy', () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])('system=%s game=%s → reduced=%s', (system, game, expected) => {
    const policy = createMotionPolicy({ system: fakeMedia(system), game: () => game });
    expect(policy.reduced()).toBe(expected);
  });

  it('works without matchMedia', () => {
    expect(createMotionPolicy({ system: null, game: () => true }).reduced()).toBe(true);
    expect(createMotionPolicy({ game: () => false }).reduced()).toBe(false);
  });

  it('notifies only when the effective value changes, from either source', () => {
    const media = fakeMedia(false);
    const game = fakeGame(false);
    const policy = createMotionPolicy({ system: media, game: game.read, onGameChange: game.subscribe });
    const listener = vi.fn();
    const off = policy.subscribe(listener);

    game.set(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    media.set(true); // still reduced: no change to report
    expect(listener).toHaveBeenCalledTimes(1);
    game.set(false); // system still asks for it
    expect(listener).toHaveBeenCalledTimes(1);
    media.set(false);
    expect(listener).toHaveBeenLastCalledWith(false);
    expect(listener).toHaveBeenCalledTimes(2);

    off();
    expect(media.listeners.size).toBe(0);
    expect(game.listeners.size).toBe(0);
  });
});
