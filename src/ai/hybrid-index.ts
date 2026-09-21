/**
 * Hybrid lexical + semantic search over a small in-memory corpus (a few hundred
 * curriculum labels), fused with RRF.
 *
 * The embedder is injected and optional: without one, or if it fails, search
 * degrades to trigram-only so the game never depends on the model being
 * downloaded. e5 models expect "query: " / "passage: " prefixes, which the
 * embedder implementation applies based on `kind`.
 */

import { reciprocalRankFusion, type Scored } from './rrf.js';
import { trigramSimilarity, trigrams } from './trigram.js';
import { cosineSimilarity } from './vector.js';

export interface Embedder {
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
}

export interface IndexedDoc {
  id: string;
  text: string;
}

export interface SearchOptions {
  limit?: number;
  /** Ignore trigram hits below this similarity (pg_trgm default is 0.3). */
  minLexical?: number;
  /**
   * e5 cosine scores are compressed (unrelated words still score ~0.8), so an
   * absolute cut-off is meaningless: keep only the closest `semanticTopK`
   * (default: `limit`) and let RRF decide.
   */
  semanticTopK?: number;
}

export class HybridIndex {
  private readonly docs = new Map<string, IndexedDoc>();
  private readonly grams = new Map<string, Set<string>>();
  private vectors = new Map<string, Float32Array>();

  constructor(private readonly embedder: Embedder | null = null) {}

  /** Lexical index is built synchronously; embeddings are added best-effort. */
  async add(docs: readonly IndexedDoc[]): Promise<void> {
    for (const doc of docs) {
      this.docs.set(doc.id, doc);
      this.grams.set(doc.id, trigrams(doc.text));
    }
    if (!this.embedder || docs.length === 0) return;
    try {
      const embedded = await this.embedder.embed(
        docs.map((d) => d.text),
        'passage',
      );
      docs.forEach((doc, i) => this.vectors.set(doc.id, embedded[i]!));
    } catch {
      // Model unavailable: keep working lexically.
    }
  }

  get hasSemantic(): boolean {
    return this.vectors.size > 0;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Scored[]> {
    const { limit = 10, minLexical = 0.2, semanticTopK = limit } = options;
    const rankings: string[][] = [this.lexicalRanking(query, minLexical)];

    if (this.embedder && this.hasSemantic) {
      try {
        const [queryVector] = await this.embedder.embed([query], 'query');
        if (queryVector) rankings.push(this.semanticRanking(queryVector, semanticTopK));
      } catch {
        // Lexical-only result below.
      }
    }
    return reciprocalRankFusion(rankings.filter((r) => r.length > 0)).slice(0, limit);
  }

  private lexicalRanking(query: string, min: number): string[] {
    const q = trigrams(query);
    return [...this.grams.entries()]
      .map(([id, g]) => ({ id, score: trigramSimilarity(q, g) }))
      .filter((hit) => hit.score >= min)
      .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
      .map((hit) => hit.id);
  }

  private semanticRanking(queryVector: Float32Array, topK: number): string[] {
    return [...this.vectors.entries()]
      .map(([id, v]) => ({ id, score: cosineSimilarity(queryVector, v) }))
      .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
      .slice(0, topK)
      .map((hit) => hit.id);
  }
}
