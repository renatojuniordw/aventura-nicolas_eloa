/**
 * Reciprocal Rank Fusion: merges several ranked lists into one without needing
 * their scores to be comparable (trigram similarity and cosine similarity are
 * not). Each list contributes 1 / (k + rank) per id; k = 60 is the usual default.
 */

export interface Scored {
  id: string;
  score: number;
}

export const RRF_K = 60;

export function reciprocalRankFusion(
  rankings: ReadonlyArray<ReadonlyArray<string>>,
  k: number = RRF_K,
): Scored[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}
