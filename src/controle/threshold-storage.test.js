import { describe, it, expect } from 'vitest';
import { loadThresholds, saveThresholds } from './threshold-storage.js';
import { DEFAULT_JUMP_DETECTOR_THRESHOLDS } from './jump-detector.js';

function makeFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

describe('threshold-storage', () => {
  it('returns the defaults when nothing was saved yet', () => {
    const storage = makeFakeStorage();
    expect(loadThresholds(storage)).toEqual(DEFAULT_JUMP_DETECTOR_THRESHOLDS);
  });

  it('round-trips a tuned set of thresholds', () => {
    const storage = makeFakeStorage();
    const tuned = { ...DEFAULT_JUMP_DETECTOR_THRESHOLDS, freefallDeltaG: 0.25, cooldownMs: 700 };

    saveThresholds(tuned, storage);

    expect(loadThresholds(storage)).toEqual(tuned);
  });

  it('falls back to defaults for corrupted JSON instead of throwing', () => {
    const storage = makeFakeStorage({ 'joguinho.controle.thresholds.v1': 'not json{{' });
    expect(loadThresholds(storage)).toEqual(DEFAULT_JUMP_DETECTOR_THRESHOLDS);
  });

  it('ignores unknown or non-numeric fields instead of trusting stored data blindly', () => {
    const storage = makeFakeStorage({
      'joguinho.controle.thresholds.v1': JSON.stringify({
        freefallDeltaG: 'not-a-number',
        impactDeltaG: 0.5,
        madeUpField: 999,
      }),
    });

    const result = loadThresholds(storage);
    expect(result.freefallDeltaG).toBe(DEFAULT_JUMP_DETECTOR_THRESHOLDS.freefallDeltaG);
    expect(result.impactDeltaG).toBe(0.5);
    expect(result.madeUpField).toBeUndefined();
  });

  it('never throws if storage itself throws (private browsing, quota, disabled)', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => loadThresholds(throwingStorage)).not.toThrow();
    expect(() => saveThresholds(DEFAULT_JUMP_DETECTOR_THRESHOLDS, throwingStorage)).not.toThrow();
  });
});
