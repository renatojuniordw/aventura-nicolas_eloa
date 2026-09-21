/**
 * Embedder backed by Transformers.js running multilingual-e5-small locally.
 *
 * Everything is served from our own origin (`/models/`, filled by
 * `npm run fetch:model`): remote models are disabled and the ONNX WASM runtime
 * is pointed at `/models/ort/`, so no request ever leaves the domain. The
 * library is imported dynamically so it stays out of the main bundle until the
 * guardian opts in.
 */

import type { Embedder } from './hybrid-index.js';

export const MODEL_ID = 'Xenova/multilingual-e5-small';

export interface EmbedderOptions {
  /** Where `models/` is served. Browser: '/'. Tests (Node): a file-system path. */
  modelBase?: string;
  /** Where the onnxruntime WASM files live; defaults to `${modelBase}models/ort/`. */
  wasmBase?: string;
}

type FeatureExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

export class TransformersEmbedder implements Embedder {
  private extractor: Promise<FeatureExtractor> | null = null;

  constructor(private readonly options: EmbedderOptions = {}) {}

  private load(): Promise<FeatureExtractor> {
    this.extractor ??= (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      const base = this.options.modelBase ?? '/';
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = `${base}models/`;
      env.useBrowserCache = typeof caches !== 'undefined';
      // One thread: multi-threaded WASM needs cross-origin isolation headers we do not send.
      const wasm = env.backends.onnx.wasm;
      if (wasm) {
        wasm.numThreads = 1;
        if (typeof window !== 'undefined') wasm.wasmPaths = this.options.wasmBase ?? `${base}models/ort/`;
      }
      const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
      return extractor as unknown as FeatureExtractor;
    })().catch((error) => {
      this.extractor = null; // allow a retry after a failed download
      throw error;
    });
    return this.extractor;
  }

  /** e5 was trained with "query: " / "passage: " prefixes; omitting them hurts quality. */
  async embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]> {
    const extractor = await this.load();
    const output = await extractor(
      texts.map((text) => `${kind}: ${text}`),
      { pooling: 'mean', normalize: true },
    );
    return output.tolist().map((row) => Float32Array.from(row));
  }
}
