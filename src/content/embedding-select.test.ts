import { describe, it, expect } from 'vitest';
import { cosineSimilarity, createSeededRandom, pickWeighted } from './embedding-select.js';

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it('is 0 when either vector is all zeros (no division by zero)', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe('pickWeighted', () => {
  it('never includes the reference id', () => {
    const rng = createSeededRandom(42);
    const picks = pickWeighted(['a', 'b', 'c', 'd'], 'a', 3, rng);
    expect(picks).not.toContain('a');
  });

  it('returns distinct ids, capped at the pool size', () => {
    const rng = createSeededRandom(1);
    const picks = pickWeighted(['a', 'b', 'c'], 'a', 10, rng);
    expect(new Set(picks).size).toBe(picks.length);
    expect(picks.length).toBe(2); // pool excludes 'a', only 'b' and 'c' remain
  });

  it('is deterministic for a fixed rng seed', () => {
    const picksA = pickWeighted(['a', 'b', 'c', 'd', 'e'], 'a', 2, createSeededRandom(7));
    const picksB = pickWeighted(['a', 'b', 'c', 'd', 'e'], 'a', 2, createSeededRandom(7));
    expect(picksA).toEqual(picksB);
  });

  it('returns an empty array when the pool is empty or count is zero', () => {
    const rng = createSeededRandom(3);
    expect(pickWeighted(['a'], 'a', 2, rng)).toEqual([]);
    expect(pickWeighted(['a', 'b'], 'a', 0, rng)).toEqual([]);
  });

  it('degrades gracefully to uniform sampling when ids have no embedding vector', () => {
    // No entries in embeddings.generated.json for these made-up ids: every
    // candidate gets equal weight, so this must still return a valid,
    // deterministic sample instead of throwing.
    const rng = createSeededRandom(99);
    const picks = pickWeighted(['zzz-unknown-1', 'zzz-unknown-2', 'zzz-unknown-3'], 'zzz-unknown-0', 2, rng);
    expect(picks.length).toBe(2);
    for (const id of picks) expect(['zzz-unknown-1', 'zzz-unknown-2', 'zzz-unknown-3']).toContain(id);
  });
});
