#!/usr/bin/env node
/**
 * Pre-computes sentence embeddings (multilingual-e5-base) for the word bank
 * and the curriculum's syllable/letter pools, so runtime selection
 * (`src/content/embedding-select.ts`) can weight "related content" choices by
 * cosine similarity without ever shipping a model or calling a network API.
 *
 * The output is plain, versioned JSON — nothing here runs at game runtime.
 * Uses e5's "query: " prefix convention for every embedded string.
 *
 * Uso: npm run generate:embeddings
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WORD_BANK } from '../src/content/word-bank.js';
import curriculumRaw from '../src/content/curriculum.json' with { type: 'json' };
import { expandCurriculum } from '../src/content/curriculum-model.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT_PATH = join(ROOT, 'src', 'content', 'embeddings.generated.json');

function meanPoolAndNormalize(output: { dims: number[]; data: ArrayLike<number | bigint> }): number[] {
  // transformers.js returns [batch, tokens, hidden] for pooling:'none' (batch is
  // always 1 here — one string per call), not [tokens, hidden] — using the
  // wrong two dims silently mean-pools over the wrong axis and yields a
  // variable-length, batch-sized vector instead of a fixed hidden-size one.
  const [tokens, dims] =
    output.dims.length === 3 ? [output.dims[1], output.dims[2]] : [output.dims[0], output.dims[1]];
  const data = output.data;
  const pooled = new Float64Array(dims);
  for (let t = 0; t < tokens; t += 1) {
    for (let d = 0; d < dims; d += 1) pooled[d] += Number(data[t * dims + d]);
  }
  for (let d = 0; d < dims; d += 1) pooled[d] /= tokens;
  let norm = 0;
  for (let d = 0; d < dims; d += 1) norm += pooled[d] * pooled[d];
  norm = Math.sqrt(norm) || 1;
  return Array.from(pooled, (v) => v / norm);
}

async function main() {
  const { pipeline } = await import('@xenova/transformers');
  const extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-base');

  const { units } = expandCurriculum(curriculumRaw);
  /** @type {{ id: string, text: string }[]} */
  const entries = [];

  for (const word of WORD_BANK) {
    entries.push({ id: word.id, text: `${word.label} ${word.fact}` });
  }
  for (const unit of units) {
    for (const label of [...new Set([...unit.pool, ...unit.distractorPool])]) {
      entries.push({ id: label, text: `${unit.title} ${label}` });
    }
  }

  const result: Record<string, number[]> = {};
  for (const entry of entries) {
    if (result[entry.id]) continue; // A syllable/letter pool label can repeat across units.
    const output = await extractor(`query: ${entry.text}`, { pooling: 'none' });
    result[entry.id] = meanPoolAndNormalize(output);
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(result)}\n`, 'utf8');
  process.stdout.write(`Geradas ${Object.keys(result).length} embeddings em src/content/embeddings.generated.json.\n`);
}

main().catch((error) => {
  console.error('Falha ao gerar embeddings:', error.message ?? error);
  process.exitCode = 1;
});
