import { SCHEMA_VERSION } from './storage-keys.js';
import { DEFAULT_CHARACTER_ID } from '../content/characters.js';

/**
 * Save-file migrations.
 *
 * A ladder of small, pure functions upgrades an old document one version at a
 * time. Adding a version means adding one step to the ladder (Open/Closed);
 * unreadable or future-version saves fall back to a fresh document instead of
 * crashing the game.
 */

export function createEmptyDocument() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: null,
    profiles: {},
    updatedAt: null,
  };
}

/** @returns {{ doc: object, migrated: boolean, reason: string|null }} */
export function migrate(raw) {
  // Nothing stored yet is not a corruption — it is a first run.
  if (raw === null || raw === undefined || raw === '') {
    return { doc: createEmptyDocument(), migrated: false, reason: null };
  }

  const parsed = parse(raw);
  if (parsed === null) {
    return { doc: createEmptyDocument(), migrated: true, reason: 'unreadable' };
  }

  const version = Number(parsed.schemaVersion ?? 0);
  if (!Number.isFinite(version) || version > SCHEMA_VERSION) {
    return { doc: createEmptyDocument(), migrated: true, reason: 'incompatible' };
  }

  let doc = parsed;
  let current = version;
  while (current < SCHEMA_VERSION) {
    const step = MIGRATIONS[current];
    if (!step) break;
    doc = step(doc);
    current += 1;
  }

  return {
    doc: normalizeDocument({ ...doc, schemaVersion: SCHEMA_VERSION }),
    migrated: current !== version,
    reason: null,
  };
}

/**
 * v0 -> v1: the first prototype stored a single implicit profile with a flat
 * progress map. v1 introduces named profiles.
 */
const MIGRATIONS = {
  0: (legacy) => {
    if (!legacy || typeof legacy !== 'object' || !legacy.progress) {
      return createEmptyDocument();
    }
    const id = 'p-legacy';
    return {
      schemaVersion: 1,
      activeProfileId: id,
      profiles: {
        [id]: {
          id,
          name: typeof legacy.profileName === 'string' ? legacy.profileName : 'Jogador',
          characterId: legacy.characterId ?? DEFAULT_CHARACTER_ID,
          createdAt: legacy.createdAt ?? null,
          progress: legacy.progress,
          stats: legacy.stats ?? { correct: 0, wrong: 0 },
        },
      },
      updatedAt: null,
    };
  },
};

function parse(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/** Guarantees the shape the stores rely on, discarding entries that are junk. */
export function normalizeDocument(doc) {
  const profiles = {};
  const source = doc.profiles && typeof doc.profiles === 'object' ? doc.profiles : {};

  for (const [id, profile] of Object.entries(source)) {
    if (!profile || typeof profile !== 'object') continue;
    profiles[id] = {
      id,
      name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : 'Jogador',
      characterId: profile.characterId ?? DEFAULT_CHARACTER_ID,
      createdAt: Number.isFinite(profile.createdAt) ? profile.createdAt : null,
      progress: normalizeProgress(profile.progress),
      stats: {
        correct: Number(profile.stats?.correct) || 0,
        wrong: Number(profile.stats?.wrong) || 0,
      },
    };
  }

  const activeProfileId =
    doc.activeProfileId && profiles[doc.activeProfileId] ? doc.activeProfileId : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId,
    profiles,
    updatedAt: Number.isFinite(doc.updatedAt) ? doc.updatedAt : null,
  };
}

function normalizeProgress(progress) {
  if (!progress || typeof progress !== 'object') return {};
  const result = {};
  for (const [lessonId, entry] of Object.entries(progress)) {
    if (!entry || typeof entry !== 'object') continue;
    result[lessonId] = {
      completed: Boolean(entry.completed),
      stars: clampStars(entry.stars),
      mistakes: Number(entry.mistakes) || 0,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : null,
    };
  }
  return result;
}

export function clampStars(value) {
  const stars = Number(value) || 0;
  return Math.max(0, Math.min(3, Math.trunc(stars)));
}
