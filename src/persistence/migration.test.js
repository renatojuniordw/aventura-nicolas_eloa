import { describe, it, expect } from 'vitest';
import { migrate, createEmptyDocument, normalizeDocument, clampStars } from './migration.js';
import { SCHEMA_VERSION } from './storage-keys.js';

describe('migrate', () => {
  it('treats a missing save as a first run', () => {
    const result = migrate(null);
    expect(result.migrated).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.doc).toEqual(createEmptyDocument());
  });

  it('keeps a valid current-version document', () => {
    const doc = {
      schemaVersion: SCHEMA_VERSION,
      activeProfileId: 'p-1',
      profiles: {
        'p-1': { id: 'p-1', name: 'Bia', characterId: 'char-lua', progress: {}, stats: {} },
      },
    };
    const result = migrate(doc);
    expect(result.migrated).toBe(false);
    expect(result.doc.activeProfileId).toBe('p-1');
    expect(result.doc.profiles['p-1'].name).toBe('Bia');
  });

  it('reports unreadable JSON as a recovery', () => {
    const result = migrate('{not json');
    expect(result.migrated).toBe(true);
    expect(result.reason).toBe('unreadable');
    expect(result.doc.profiles).toEqual({});
  });

  it('rejects a save written by a future version', () => {
    const result = migrate({ schemaVersion: SCHEMA_VERSION + 1, profiles: {} });
    expect(result.reason).toBe('incompatible');
    expect(result.doc.profiles).toEqual({});
  });

  it('upgrades a v0 save into a v1 profile', () => {
    const legacy = {
      profileName: 'Léo',
      characterId: 'char-flor',
      progress: { 'letra-a': { completed: true, stars: 2, mistakes: 1 } },
    };
    const result = migrate(legacy);
    expect(result.migrated).toBe(true);
    expect(result.doc.schemaVersion).toBe(SCHEMA_VERSION);

    const profile = result.doc.profiles['p-legacy'];
    expect(profile.name).toBe('Léo');
    expect(profile.characterId).toBe('char-flor');
    expect(profile.progress['letra-a'].completed).toBe(true);
    expect(result.doc.activeProfileId).toBe('p-legacy');
  });

  it('upgrades a v0 save that has no progress field into an empty document', () => {
    const result = migrate({ somethingElse: true });
    expect(result.doc.profiles).toEqual({});
  });
});

describe('normalizeDocument', () => {
  it('drops junk profiles and repairs missing fields', () => {
    const doc = normalizeDocument({
      schemaVersion: 1,
      activeProfileId: 'missing',
      profiles: {
        good: { name: '  Ana  ', progress: { x: { completed: true, stars: 99 } } },
        bad: 'not-an-object',
        empty: null,
      },
    });
    expect(Object.keys(doc.profiles)).toEqual(['good']);
    expect(doc.profiles.good.name).toBe('Ana');
    expect(doc.profiles.good.stars).toBeUndefined();
    expect(doc.profiles.good.progress.x.stars).toBe(3);
    // An active profile that does not exist is reset.
    expect(doc.activeProfileId).toBeNull();
  });

  it('falls back to a default name and character', () => {
    const doc = normalizeDocument({ schemaVersion: 1, profiles: { a: {} } });
    expect(doc.profiles.a.name).toBe('Jogador');
    expect(doc.profiles.a.characterId).toBeTruthy();
    expect(doc.profiles.a.stats).toEqual({ correct: 0, wrong: 0 });
  });

  it('clamps stars into range', () => {
    expect(clampStars(-4)).toBe(0);
    expect(clampStars(99)).toBe(3);
    expect(clampStars('2')).toBe(2);
    expect(clampStars(undefined)).toBe(0);
  });
});
