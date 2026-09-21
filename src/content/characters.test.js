import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHARACTERS } from './characters.ts';

const publicPath = (url) => join(process.cwd(), 'public', url);

describe('CHARACTERS assets', () => {
  it.each(CHARACTERS.map((c) => [c.id, c]))('%s has all sprite and portrait files', (_id, c) => {
    for (const url of [c.portrait, ...Object.values(c.sprites)]) {
      expect(existsSync(publicPath(url)), url).toBe(true);
    }
  });

  it('gives each character its own sprite folder', () => {
    const folders = CHARACTERS.map((c) => c.sprites.idle.split('/').slice(0, -1).join('/'));
    expect(new Set(folders).size).toBe(CHARACTERS.length);
  });
});
