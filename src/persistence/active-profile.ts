import { DEFAULT_CHARACTER_ID } from '../content/characters.js';
import type { Profile } from './migration.js';
import type { ProfileStore } from './profile-store.js';

/** Name of the profile created on first run (and given to nameless legacy profiles). */
export const DEFAULT_PLAYER_NAME = 'Nicolas';

type ProfileAccess = Pick<
  ProfileStore,
  'getActiveProfile' | 'listProfiles' | 'setActiveProfile' | 'hasParentalConsent' | 'createProfile' | 'renameProfile'
>;

export type ActiveProfileResult =
  | { status: 'ready'; profile: Profile | null }
  | { status: 'needs-consent' };

/**
 * First-run and legacy-data policy for "who is playing": adopts an existing
 * profile when none is active, holds back profile creation until the
 * responsible adult has confirmed the privacy notice, and gives nameless
 * profiles the default name. The menu asks this once per render instead of
 * carrying the rules itself.
 */
export function resolveActiveProfile(profiles: ProfileAccess): ActiveProfileResult {
  let active = profiles.getActiveProfile();
  if (!active) {
    const existing = profiles.listProfiles()[0];
    if (existing) {
      profiles.setActiveProfile(existing.id);
      active = existing;
    } else if (!profiles.hasParentalConsent()) {
      return { status: 'needs-consent' };
    } else {
      active = profiles.createProfile(DEFAULT_PLAYER_NAME, DEFAULT_CHARACTER_ID);
    }
  }
  if (active && (active.name === 'Jogador' || !active.name)) {
    profiles.renameProfile(active.id, DEFAULT_PLAYER_NAME);
    active = profiles.getActiveProfile();
  }
  return { status: 'ready', profile: active };
}
