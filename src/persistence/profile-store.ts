import { DEFAULT_CHARACTER_ID, getCharacter } from '../content/characters.js';
import type { Profile } from './migration.js';
import type { SaveStore } from './save-store.js';

interface ProfileStoreOptions {
  saves: SaveStore;
  now?: () => number;
  idFactory?: () => string;
}

/**
 * Player profiles (one per child). Each profile keeps its own progress, so
 * siblings sharing a device never overwrite each other's unlocks.
 */
export class ProfileStore {
  private _saves: SaveStore;
  private _now: () => number;
  private _idFactory: () => string;

  constructor({ saves, now = () => Date.now(), idFactory = defaultIdFactory }: ProfileStoreOptions) {
    this._saves = saves;
    this._now = now;
    this._idFactory = idFactory;
  }

  listProfiles(): Profile[] {
    return Object.values(this._saves.read().profiles);
  }

  getProfile(profileId: string): Profile | null {
    return this._saves.read().profiles[profileId] ?? null;
  }

  getActiveProfile(): Profile | null {
    const doc = this._saves.read();
    return doc.activeProfileId ? (doc.profiles[doc.activeProfileId] ?? null) : null;
  }

  /**
   * Whether the responsible adult has confirmed the privacy notice.
   * Stored at the document level (not per profile) so it survives profile
   * deletion and is asked only once per device.
   */
  hasParentalConsent(): boolean {
    return this._saves.read().parentalConsent === true;
  }

  recordParentalConsent(): boolean {
    return this._saves.update((doc) => {
      doc.parentalConsent = true;
      return true;
    });
  }

  createProfile(name: string, characterId: string = DEFAULT_CHARACTER_ID): Profile {
    const id = this._idFactory();
    const profile: Profile = {
      id,
      name: normalizeName(name),
      characterId: getCharacter(characterId).id,
      createdAt: this._now(),
      progress: {},
      stats: { correct: 0, wrong: 0 },
    };
    this._saves.update((doc) => {
      doc.profiles[id] = profile;
      doc.activeProfileId = id;
    });
    return profile;
  }

  setActiveProfile(profileId: string): Profile | null {
    return this._saves.update((doc) => {
      if (!doc.profiles[profileId]) return null;
      doc.activeProfileId = profileId;
      return doc.profiles[profileId];
    });
  }

  setCharacter(profileId: string, characterId: string): Profile | null {
    return this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;
      profile.characterId = getCharacter(characterId).id;
      return profile;
    });
  }

  renameProfile(profileId: string, name: string): Profile | null {
    return this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;
      profile.name = normalizeName(name);
      return profile;
    });
  }

  deleteProfile(profileId: string): void {
    return this._saves.update((doc) => {
      delete doc.profiles[profileId];
      if (doc.activeProfileId === profileId) {
        doc.activeProfileId = Object.keys(doc.profiles)[0] ?? null;
      }
    });
  }
}

function normalizeName(name: unknown): string {
  const trimmed = String(name ?? '').trim();
  return trimmed === '' ? 'Jogador' : trimmed.slice(0, 24);
}

function defaultIdFactory(): string {
  if (globalThis.crypto?.randomUUID) {
    return `p-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}
