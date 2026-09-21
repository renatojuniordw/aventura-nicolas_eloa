/**
 * Trigram similarity, the in-browser counterpart of Postgres `pg_trgm`.
 *
 * Text is normalised (case and accents ignored), split into words, each word is
 * padded with two leading spaces and one trailing space, and the set of
 * 3-character windows is compared with Jaccard similarity — the same recipe
 * pg_trgm uses, so a typo like "cachoro" still finds "CACHORRO".
 */

import { normalize } from '../content/text-utils.js';

export function trigrams(text: string): Set<string> {
  const result = new Set<string>();
  for (const word of normalize(text).split(/[^\p{L}\p{N}]+/u)) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) result.add(padded.slice(i, i + 3));
  }
  return result;
}

export function trigramSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / (a.size + b.size - shared);
}
