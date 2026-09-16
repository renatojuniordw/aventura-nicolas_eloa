import { DEFAULT_CHARACTER_ID, getCharacter } from '../content/characters.js';

/**
 * Player profiles (one per child). Each profile keeps its own progress, so
 * siblings sharing a device never overwrite each other's unlocks.
 */
export class ProfileStore {
  constructor({ saves, now = () => Date.now(), idFactory = defaultIdFactory }) {
    this._saves = saves;
    this._now = now;
    this._idFactory = idFactory;
  }

  listProfiles() {
    return Object.values(this._saves.read().profiles);
  }

  getProfile(profileId) {
    return this._saves.read().profiles[profileId] ?? null;
  }

  getActiveProfile() {
    const doc = this._saves.read();
    return doc.activeProfileId ? (doc.profiles[doc.activeProfileId] ?? null) : null;
  }

  createProfile(name, characterId = DEFAULT_CHARACTER_ID) {
    const id = this._idFactory();
    const profile = {
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

  setActiveProfile(profileId) {
    return this._saves.update((doc) => {
      if (!doc.profiles[profileId]) return null;
      doc.activeProfileId = profileId;
      return doc.profiles[profileId];
    });
  }

  setCharacter(profileId, characterId) {
    return this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;
      profile.characterId = getCharacter(characterId).id;
      return profile;
    });
  }

  renameProfile(profileId, name) {
    return this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;
      profile.name = normalizeName(name);
      return profile;
    });
  }

  deleteProfile(profileId) {
    return this._saves.update((doc) => {
      delete doc.profiles[profileId];
      if (doc.activeProfileId === profileId) {
        doc.activeProfileId = Object.keys(doc.profiles)[0] ?? null;
      }
    });
  }
}

function normalizeName(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed === '' ? 'Jogador' : trimmed.slice(0, 24);
}

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) {
    return `p-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}
