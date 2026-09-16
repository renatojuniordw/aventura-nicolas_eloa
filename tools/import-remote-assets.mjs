import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public', 'assets');

const BASE_RAW_URL = 'https://raw.githubusercontent.com/samarameneses/aventura-das-letras/main/assets';

const FILES_TO_DOWNLOAD = [
  // Manifest
  'manifest.json',

  // Backgrounds
  'backgrounds/garden-background-v1.png',
  'backgrounds/garden-pixel-v1.png',
  'backgrounds/outono-bosque-pixel-v1.png',
  'backgrounds/outono-vale-pixel-v1.png',
  'backgrounds/primavera-lago-pixel-v1.png',
  'backgrounds/primavera-pomar-pixel-v1.png',

  // Items
  'items/letter-carrier-pixel-v1.png',
  'items/speed-item-pixel-v1.png',

  // Objects
  'objects/checkpoint-pixel-v1.png',
  'objects/finish-portal-pixel-v1.png',

  // Terrain
  'terrain/garden-modules-concept-v1.png',
  'terrain/garden-pixel-modules-v1.png',
  'terrain/grass-tile-pixel-v1.png',
];

async function downloadFile(relPath) {
  const url = `${BASE_RAW_URL}/${relPath}`;
  const destPath = path.join(ASSETS_DIR, relPath);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  console.log(`Downloading: ${relPath} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`Saved: ${destPath} (${buffer.length} bytes)`);
}

async function run() {
  console.log('Starting remote assets import from samarameneses/aventura-das-letras...');
  console.log(`Destination: ${ASSETS_DIR}`);

  for (const file of FILES_TO_DOWNLOAD) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`Error downloading ${file}:`, err.message);
    }
  }

  console.log('Remote assets import complete!');
}

run();
