import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HybridIndex } from './hybrid-index.js';
import { TransformersEmbedder } from './transformers-embedder.js';

const ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
const hasModel = existsSync(`${ROOT}models/Xenova/multilingual-e5-small/onnx/model_quantized.onnx`);

// Integration test against the real model: skipped when `npm run fetch:model` was not run.
describe.skipIf(!hasModel)('TransformersEmbedder (real model)', () => {
  it('finds semantically related words with no shared letters', async () => {
    const index = new HybridIndex(new TransformersEmbedder({ modelBase: ROOT }));
    await index.add(
      ['CACHORRO', 'GATO', 'PATO', 'VACA', 'BANANA', 'LARANJA', 'BOLA', 'CARRO'].map((text) => ({ id: text, text })),
    );
    expect(index.hasSemantic).toBe(true);
    // Category words work for some themes (fruits) ...
    const fruits = (await index.search('frutas', { limit: 3 })).map((h) => h.id);
    expect(fruits).toEqual(expect.arrayContaining(['BANANA', 'LARANJA']));
    // ... and word-to-word neighbourhood works for animals: 'gato' also surfaces 'pato'/'vaca'.
    const near = (await index.search('gato', { limit: 4 })).map((h) => h.id);
    expect(near[0]).toBe('GATO');
    expect(near).toEqual(expect.arrayContaining(['PATO']));
  }, 120_000);
});
