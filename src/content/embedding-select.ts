import embeddings from './embeddings.generated.json';

type EmbeddingMap = Record<string, number[]>;

// Offline experiment, not used by the game yet: nothing outside this module's
// tests imports it, so the ~3MB vectors never reach the bundle (the
// `embeddings-data` chunk in vite.config.js is only emitted once a game module
// imports this file). `embeddings.generated.json` is committed and regenerated
// with `npm run generate:embeddings` (tools/generate-embeddings.mts); the
// import is static, so the file must exist. It may be *incomplete*, though:
// ids without a vector fall back to uniform weight instead of throwing.
// Any future in-game use needs pedagogical review and should load it lazily.
const EMBEDDINGS: EmbeddingMap = (embeddings as EmbeddingMap) ?? {};

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic seeded PRNG (LCG): `state = imul(state, 1664525) + 1013904223`.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function weightedSampleWithoutReplacement(
  candidates: { id: string; weight: number }[],
  count: number,
  rng: () => number,
): string[] {
  const pool = candidates.map((entry) => ({ ...entry, weight: Math.max(entry.weight, 1e-6) }));
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(pool[index].id);
    pool.splice(index, 1);
  }
  return picked;
}

/**
 * Picks `count` ids from `candidateIds` (excluding `referenceId`), weighted by
 * embedding similarity to `referenceId` when both have vectors. Ids with no
 * embedding fall back to uniform-random weight, so a missing/partial
 * `embeddings.generated.json` never crashes selection — it just loses the
 * "thematically related" ordering benefit for those ids.
 */
export function pickWeighted(
  candidateIds: string[],
  referenceId: string,
  count: number,
  rng: () => number,
): string[] {
  const pool = candidateIds.filter((id) => id !== referenceId);
  if (pool.length === 0 || count <= 0) return [];

  const referenceVector = EMBEDDINGS[referenceId];
  const weighted = pool.map((id) => {
    const vector = EMBEDDINGS[id];
    if (referenceVector && vector) {
      // Cosine similarity is in [-1, 1]; shift to a positive weight so
      // dissimilar-but-valid candidates still have a (small) chance to appear.
      const similarity = cosineSimilarity(referenceVector, vector);
      return { id, weight: similarity + 1 };
    }
    return { id, weight: 1 };
  });

  return weightedSampleWithoutReplacement(weighted, Math.min(count, pool.length), rng);
}
