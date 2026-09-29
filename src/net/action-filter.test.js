import { describe, it, expect } from 'vitest';
import { ActionFilter } from './action-filter.js';

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
});
