import { describe, expect, it } from 'vitest';
import { HybridIndex } from './hybrid-index.js';
import { reciprocalRankFusion } from './rrf.js';
import { trigramSimilarity, trigrams } from './trigram.js';
import { cosineSimilarity } from './vector.js';

const DOCS = ['CACHORRO', 'GATO', 'PATO', 'BANANA', 'MAÇÃ', 'UVA'].map((text) => ({
  id: text,
  text,
}));

// Deterministic fake embedder: animals point along axis 0, fruits along axis 1.
const ANIMALS = new Set(['CACHORRO', 'GATO', 'PATO', 'bichos']);
const fakeEmbedder = {
  async embed(texts) {
    return texts.map((t) => (ANIMALS.has(t) ? Float32Array.of(1, 0) : Float32Array.of(0, 1)));
  },
};

describe('trigram similarity', () => {
  it('ignores case and accents and tolerates typos', () => {
    expect(trigramSimilarity(trigrams('maçã'), trigrams('MACA'))).toBe(1);
    expect(trigramSimilarity(trigrams('cachoro'), trigrams('CACHORRO'))).toBeGreaterThan(0.4);
    expect(trigramSimilarity(trigrams('gato'), trigrams('banana'))).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for parallel, 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(Float32Array.of(1, 2), Float32Array.of(2, 4))).toBeCloseTo(1);
    expect(cosineSimilarity(Float32Array.of(1, 0), Float32Array.of(0, 1))).toBe(0);
  });
});

describe('reciprocalRankFusion', () => {
  it('rewards ids ranked well by several lists', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['b', 'a', 'd'],
    ]);
    expect(fused.map((f) => f.id).slice(0, 2).sort()).toEqual(['a', 'b']);
    expect(fused.at(-1).id).toBe('d');
  });
});

describe('HybridIndex', () => {
  it('works lexically without an embedder', async () => {
    const index = new HybridIndex();
    await index.add(DOCS);
    expect(index.hasSemantic).toBe(false);
    const [top] = await index.search('cachoro');
    expect(top.id).toBe('CACHORRO');
  });

  it('adds semantic matches that share no letters with the query', async () => {
    const index = new HybridIndex(fakeEmbedder);
    await index.add(DOCS);
    const ids = (await index.search('bichos')).map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(['CACHORRO', 'GATO', 'PATO']));
  });

  it('degrades to lexical when the embedder fails', async () => {
    const broken = { embed: async () => { throw new Error('offline'); } };
    const index = new HybridIndex(broken);
    await index.add(DOCS);
    expect(index.hasSemantic).toBe(false);
    expect((await index.search('gato'))[0].id).toBe('GATO');
  });
});
