import { describe, it, expect } from 'vitest';
import { ActionFilter, MAX_ACTION_DELAY_MS } from './action-filter.js';

const jump = (generation, seq) => ({ button: 'jump', pressed: true, generation, seq });

describe('ActionFilter', () => {
  it('accepts fresh commands in order and rejects duplicates', () => {
    const filter = new ActionFilter();
    expect(filter.accept(jump(1, 1))).toBe(true);
    expect(filter.accept(jump(1, 2))).toBe(true);
    expect(filter.accept(jump(1, 2))).toBe(false);
    expect(filter.accept(jump(1, 1))).toBe(false);
  });

  it('drops commands from an earlier controller connection once a newer one is known', () => {
    const filter = new ActionFilter();
    filter.observeGeneration(3);
    expect(filter.accept(jump(2, 50))).toBe(false);
    expect(filter.accept(jump(3, 1))).toBe(true);
  });

  it('a new generation starts its own numbering', () => {
    const filter = new ActionFilter();
    expect(filter.accept(jump(1, 9))).toBe(true);
    expect(filter.accept(jump(2, 1))).toBe(true);
    expect(filter.accept(jump(1, 10))).toBe(false);
  });

  it('accepts commands without a number (no dedup possible) but still checks the generation', () => {
    const filter = new ActionFilter();
    filter.observeGeneration(2);
    expect(filter.accept(jump(2, null))).toBe(true);
    expect(filter.accept(jump(1, null))).toBe(false);
  });

  it('rejects malformed stamps', () => {
    const filter = new ActionFilter();
    expect(filter.accept({ button: 'jump', pressed: true, generation: Number.NaN, seq: 1 })).toBe(false);
    expect(filter.accept(jump(1, 1.5))).toBe(false);
  });

  describe('late commands (no synchronised clocks)', () => {
    // The phone's clock runs 1 000 000 ms "ahead": only differences matter.
    const PHONE = 1_000_000;
    const at = (generation, seq, sentAt) => ({ ...jump(generation, seq), sentAt: PHONE + sentAt });

    it('drops a command that took much longer than the fastest transit seen', () => {
      const filter = new ActionFilter();
      filter.observeGeneration(1);
      filter.observeClock(1, PHONE + 0, 40); // beacon: 40 ms transit
      expect(filter.accept(at(1, 1, 1000), 1060)).toBe(true); // 60 ms
      expect(filter.accept(at(1, 2, 2000), 2000 + 40 + MAX_ACTION_DELAY_MS)).toBe(true);
      // Same connection, next number, but delayed in transit.
      expect(filter.accept(at(1, 3, 3000), 3000 + 40 + MAX_ACTION_DELAY_MS + 1)).toBe(false);
      // Lateness does not poison the estimate: a normal one after it passes.
      expect(filter.accept(at(1, 4, 5000), 5050)).toBe(true);
    });

    it('the estimate restarts with each connection (a new page has a new clock)', () => {
      const filter = new ActionFilter();
      filter.observeGeneration(1);
      filter.observeClock(1, PHONE, 40);
      filter.observeGeneration(2);
      // With the old estimate this would look 999 960 ms late.
      expect(filter.accept({ ...jump(2, 1), sentAt: 0 }, 1_000_000)).toBe(true);
      // Beacons of another generation never feed the current estimate.
      filter.observeClock(1, 999_000, 1_000_010);
      expect(filter.accept({ ...jump(2, 2), sentAt: 500 }, 1_000_540)).toBe(true);
    });

    it('drops anything sent before the match (re)started accepting commands', () => {
      const filter = new ActionFilter();
      filter.observeGeneration(1);
      filter.observeClock(1, PHONE + 0, 30);
      filter.armAt(1000);
      // Sent at 900 (arrives 930 if fast) — made on the pause screen, late or not.
      expect(filter.accept(at(1, 1, 900), 1005)).toBe(false);
      expect(filter.accept(at(1, 2, 980), 1010)).toBe(true);
    });

    it('never replays a burst accumulated before a pause', () => {
      const filter = new ActionFilter();
      filter.observeGeneration(1);
      filter.observeClock(1, PHONE + 0, 20);
      filter.armAt(10_000);
      let accepted = 0;
      for (let i = 1; i <= 10; i += 1) if (filter.accept(at(1, i, 5000 + i * 100), 10_050 + i)) accepted += 1;
      expect(accepted).toBe(0);
    });
  });
});
