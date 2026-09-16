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

export interface ProgressEntry {
  completed: boolean;
  stars: number;
  mistakes: number;
  updatedAt: number | null;
}

export interface Profile {
  id: string;
  name: string;
  characterId: string;
  createdAt: number | null;
  progress: Record<string, ProgressEntry>;
  stats: { correct: number; wrong: number };
  speedrunBestTime?: number | null;
}

export interface SaveDocument {
  schemaVersion: number;
  activeProfileId: string | null;
  profiles: Record<string, Profile>;
  parentalConsent: boolean;
  updatedAt: number | null;
}

export function createEmptyDocument(): SaveDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: null,
    profiles: {},
    parentalConsent: false,
    updatedAt: null,
  };
}

export interface MigrateResult {
  doc: SaveDocument;
  migrated: boolean;
  reason: string | null;
}

export function migrate(raw: unknown): MigrateResult {
  // Nothing stored yet is not a corruption — it is a first run.
  if (raw === null || raw === undefined || raw === '') {
    return { doc: createEmptyDocument(), migrated: false, reason: null };
  }

  const parsed = parse(raw);
  if (parsed === null) {
    return { doc: createEmptyDocument(), migrated: true, reason: 'unreadable' };
  }

  const version = Number((parsed as Record<string, unknown>).schemaVersion ?? 0);
  if (!Number.isFinite(version) || version > SCHEMA_VERSION) {
    return { doc: createEmptyDocument(), migrated: true, reason: 'incompatible' };
  }

  let doc: Record<string, unknown> = parsed;
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
const MIGRATIONS: Record<number, (legacy: Record<string, unknown>) => Record<string, unknown>> = {
  0: (legacy) => {
    if (!legacy || typeof legacy !== 'object' || !legacy.progress) {
      return createEmptyDocument() as unknown as Record<string, unknown>;
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

function parse(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/** Guarantees the shape the stores rely on, discarding entries that are junk. */
export function normalizeDocument(doc: Record<string, unknown>): SaveDocument {
  const profiles: Record<string, Profile> = {};
  const source =
    doc.profiles && typeof doc.profiles === 'object' ? (doc.profiles as Record<string, unknown>) : {};

  for (const [id, profile] of Object.entries(source)) {
    if (!profile || typeof profile !== 'object') continue;
    const p = profile as Record<string, unknown>;
    const stats = p.stats as Record<string, unknown> | undefined;
    profiles[id] = {
      id,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Jogador',
      characterId: (p.characterId as string) ?? DEFAULT_CHARACTER_ID,
      createdAt: Number.isFinite(p.createdAt) ? (p.createdAt as number) : null,
      progress: normalizeProgress(p.progress),
      stats: {
        correct: Number(stats?.correct) || 0,
        wrong: Number(stats?.wrong) || 0,
      },
      speedrunBestTime: Number.isFinite(p.speedrunBestTime) ? (p.speedrunBestTime as number) : null,
    };
  }

  const activeProfileId =
    doc.activeProfileId && profiles[doc.activeProfileId as string] ? (doc.activeProfileId as string) : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId,
    profiles,
    parentalConsent: doc.parentalConsent === true,
    updatedAt: Number.isFinite(doc.updatedAt) ? (doc.updatedAt as number) : null,
  };
}

function normalizeProgress(progress: unknown): Record<string, ProgressEntry> {
  if (!progress || typeof progress !== 'object') return {};
  const result: Record<string, ProgressEntry> = {};
  for (const [lessonId, entry] of Object.entries(progress as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    result[lessonId] = {
      completed: Boolean(e.completed),
      stars: clampStars(e.stars),
      mistakes: Number(e.mistakes) || 0,
      updatedAt: Number.isFinite(e.updatedAt) ? (e.updatedAt as number) : null,
    };
  }
  return result;
}

export function clampStars(value: unknown): number {
  const stars = Number(value) || 0;
  return Math.max(0, Math.min(3, Math.trunc(stars)));
}
