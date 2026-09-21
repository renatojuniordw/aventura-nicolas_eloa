import { describe, it, expect } from 'vitest';
import { resolveEventTime } from './sensor-time.js';

describe('resolveEventTime', () => {
  it('uses the event time when it is recent and in the past', () => {
    expect(resolveEventTime(990, 1000)).toBe(990);
  });

  it('falls back to handler time for a missing, future or foreign-clock stamp', () => {
    expect(resolveEventTime(0, 1000)).toBe(1000);
    expect(resolveEventTime(Number.NaN, 1000)).toBe(1000);
    expect(resolveEventTime(1500, 1000)).toBe(1000);
    expect(resolveEventTime(1_700_000_000_000, 1000)).toBe(1000);
    expect(resolveEventTime(10, 5000)).toBe(5000);
  });
});
