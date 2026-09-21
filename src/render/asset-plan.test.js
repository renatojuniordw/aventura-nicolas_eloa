import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { BACKGROUND_ASSETS, WORLD_ASSETS, characterAssets, lessonAssets } from './asset-plan.js';
import { CHARACTERS } from '../content/characters.js';
import { resolveBackgroundKey } from './sprite-assets.js';
import { POSE_BY_STATE } from '../content/atlas-meta.js';

describe('asset plan', () => {
  it('points every background, world and character asset at a file that exists', () => {
    const all = [
      ...Object.values(BACKGROUND_ASSETS),
      ...Object.values(WORLD_ASSETS),
      ...CHARACTERS.flatMap((character) => Object.values(characterAssets(character))),
      ...CHARACTERS.flatMap((character) => [character.portrait, character.sprites.celebrate]),
    ];
    for (const src of all) expect(existsSync(`public${src}`), src).toBe(true);
  });

  it('covers every background key resolveBackgroundKey can return', () => {
    const levels = [
      null,
      { background: 'bg:outono-vale' },
      { background: 'pomar.png' },
      { background: 'bosque.png' },
      { background: 'vale.png' },
      { background: 'garden.png' },
      { id: 'fase-palavras-x' },
      { id: 'fase-silabas-x' },
      { id: 'fase-encontros-x' },
      { id: 'fase-alfabeto-a' },
    ];
    for (const level of levels) {
      expect(BACKGROUND_ASSETS[resolveBackgroundKey(level)]).toBeTruthy();
    }
  });

  it('loads only the poses gameplay draws, namespaced by character', () => {
    const [character] = CHARACTERS;
    const assets = characterAssets(character);
    expect(Object.keys(assets).sort()).toEqual(
      [...new Set(Object.values(POSE_BY_STATE))].map((pose) => `${character.id}:${pose}`).sort(),
    );
    expect(assets[`${character.id}:celebrate`]).toBeUndefined();
  });

  it('asks a lesson for its own background plus the active character, nothing else', () => {
    const [character] = CHARACTERS;
    const assets = lessonAssets({ id: 'fase-silabas-ba' }, character);
    expect(assets['bg:primavera-pomar']).toBe(BACKGROUND_ASSETS['bg:primavera-pomar']);
    expect(Object.keys(assets).filter((key) => key.startsWith('bg:'))).toHaveLength(1);
    expect(assets[`${character.id}:idle`]).toBeDefined();
  });
});
