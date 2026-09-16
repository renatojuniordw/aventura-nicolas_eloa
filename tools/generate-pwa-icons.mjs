import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/**
 * Generates the PWA app icons as plain PNGs, with no image-library
 * dependency (matches the project's zero-dependency build tooling, see
 * generate-levels.mjs). Draws a small pixel-grid "A" glyph — the same
 * lettered-token motif already used for in-game collectibles — on the
 * game's gold background, then upscales it with nearest-neighbor so edges
 * stay crisp at every icon size.
 */

const GOLD = [255, 212, 121, 255]; // --color-gold
const INK = [35, 61, 56, 255]; // --color-ink

// 10x12 block letter "A", 1 = ink pixel.
const GLYPH = [
  '0001111000',
  '0011111100',
  '0111001110',
  '0111001110',
  '0111001110',
  '0111111110',
  '0111111110',
  '0111001110',
  '0111001110',
  '0111001110',
  '0111001110',
  '0111001110',
].map((row) => row.split('').map((c) => c === '1'));

const GLYPH_W = GLYPH[0].length;
const GLYPH_H = GLYPH.length;

/** Renders the icon into an RGBA buffer of `size`x`size` pixels. */
function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels.set(GOLD, i * 4);
  }

  // Glyph occupies the central ~60% of the canvas (safe for maskable icons,
  // which crop up to 20% off each edge).
  const glyphScale = Math.floor((size * 0.6) / GLYPH_W);
  const glyphPixelW = GLYPH_W * glyphScale;
  const glyphPixelH = GLYPH_H * glyphScale;
  const offsetX = Math.floor((size - glyphPixelW) / 2);
  const offsetY = Math.floor((size - glyphPixelH) / 2);

  for (let gy = 0; gy < GLYPH_H; gy++) {
    for (let gx = 0; gx < GLYPH_W; gx++) {
      if (!GLYPH[gy][gx]) continue;
      for (let py = 0; py < glyphScale; py++) {
        for (let px = 0; px < glyphScale; px++) {
          const x = offsetX + gx * glyphScale + px;
          const y = offsetY + gy * glyphScale + py;
          const idx = (y * size + x) * 4;
          pixels.set(INK, idx);
        }
      }
    }
  }
  return pixels;
}

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Encodes an RGBA pixel buffer as a minimal (uncompressed-filter) PNG. */
function encodePng(pixels, size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // One filter-type byte (0 = none) per scanline, then raw RGBA rows.
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;
    pixels
      .subarray(y * size * 4, (y + 1) * size * 4)
      .forEach((byte, i) => (raw[rowStart + 1 + i] = byte));
  }

  const idat = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = encodePng(renderIcon(size), size);
  writeFileSync(new URL(`icon-${size}.png`, outDir), png);
  console.log(`wrote public/icons/icon-${size}.png (${png.length} bytes)`);
}
