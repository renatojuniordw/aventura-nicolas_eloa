import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards the "moved/renamed/deleted an asset but a stylesheet still points at
 * it" class of bug: a missing file is not a build error (the dev/preview server
 * answers with the SPA fallback), it just silently breaks a background.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('public asset references', () => {
  it('every /assets, /icons and /fonts path used by styles, markup and code exists in public/', () => {
    const files = [
      ...walk(SRC).filter((file) => /\.(css|ts|tsx)$/.test(file) && !file.includes('/levels/')),
      join(ROOT, 'index.html'),
      join(ROOT, 'controle.html'),
    ];
    const missing = [];
    for (const file of files) {
      for (const [, path] of readFileSync(file, 'utf8').matchAll(/['"(](\/(?:assets|icons|fonts)\/[\w\-./]+)/g)) {
        if (!existsSync(join(ROOT, 'public', path))) missing.push(`${file.replace(ROOT, '')} -> ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
