/**
 * Prepares the local semantic-search model under public/models/ so the game
 * never contacts Hugging Face or a CDN at runtime (see docs/10-privacidade-e-lgpd.md).
 *
 * - downloads multilingual-e5-small (quantized ONNX, ~130MB) once;
 * - copies the onnxruntime-web WASM runtime from node_modules.
 *
 * public/models/ is git-ignored: the ONNX file exceeds GitHub's 100MB limit.
 * Runs automatically in the Docker build; locally: npm run fetch:model
 */

import { copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_ID = 'Xenova/multilingual-e5-small';
const MODEL_DIR = join(ROOT, 'public/models', MODEL_ID);
const ORT_DIR = join(ROOT, 'public/models/ort');
const BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/model_quantized.onnx',
];

async function download(file) {
  const target = join(MODEL_DIR, file);
  if (existsSync(target)) return;
  mkdirSync(dirname(target), { recursive: true });
  const response = await fetch(`${BASE}/${file}`);
  if (!response.ok) throw new Error(`Falha ao baixar ${file}: HTTP ${response.status}`);
  // Write to a temp name first so an interrupted download is never mistaken for a full file.
  const tmp = `${target}.part`;
  writeFileSync(tmp, Buffer.from(await response.arrayBuffer()));
  renameSync(tmp, target);
  console.log(`  ✓ ${file}`);
}

mkdirSync(ORT_DIR, { recursive: true });
const ortSource = join(ROOT, 'node_modules/onnxruntime-web/dist');
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  copyFileSync(join(ortSource, file), join(ORT_DIR, file));
}
for (const file of FILES) await download(file);
console.log('Modelo pronto em public/models/');
