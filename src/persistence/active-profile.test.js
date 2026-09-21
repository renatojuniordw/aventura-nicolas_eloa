import { describe, it, expect, vi } from 'vitest';
import { resolveActiveProfile, DEFAULT_PLAYER_NAME } from './active-profile.js';

function fakeProfiles({ active = null, list = [], consent = true } = {}) {
  let current = active;
  return {
    getActiveProfile: vi.fn(() => current),
    listProfiles: vi.fn(() => list),
    setActiveProfile: vi.fn((id) => { current = list.find((p) => p.id === id) ?? null; }),
    hasParentalConsent: vi.fn(() => consent),
    createProfile: vi.fn((name, characterId) => (current = { id: 'new', name, characterId })),
    renameProfile: vi.fn((id, name) => { current = { ...current, name }; }),
  };
}

describe('resolveActiveProfile', () => {
  it('returns the active profile untouched', () => {
    const profiles = fakeProfiles({ active: { id: 'a', name: 'Eloá' } });
    expect(resolveActiveProfile(profiles)).toEqual({ status: 'ready', profile: { id: 'a', name: 'Eloá' } });
    expect(profiles.createProfile).not.toHaveBeenCalled();
    expect(profiles.renameProfile).not.toHaveBeenCalled();
  });

  it('adopts the first existing profile when none is active', () => {
    const profiles = fakeProfiles({ list: [{ id: 'x', name: 'Eloá' }] });
    const result = resolveActiveProfile(profiles);
    expect(profiles.setActiveProfile).toHaveBeenCalledWith('x');
    expect(result).toEqual({ status: 'ready', profile: { id: 'x', name: 'Eloá' } });
  });

  it('holds back profile creation until the privacy notice is confirmed', () => {
    const profiles = fakeProfiles({ consent: false });
    expect(resolveActiveProfile(profiles)).toEqual({ status: 'needs-consent' });
    expect(profiles.createProfile).not.toHaveBeenCalled();
  });

  it('creates the default profile once consent was given', () => {
    const profiles = fakeProfiles();
    const result = resolveActiveProfile(profiles);
    expect(profiles.createProfile).toHaveBeenCalledWith(DEFAULT_PLAYER_NAME, 'char-nicolas');
    expect(result.status).toBe('ready');
    expect(result.profile.name).toBe(DEFAULT_PLAYER_NAME);
  });

  it('renames a legacy "Jogador" profile', () => {
    const profiles = fakeProfiles({ active: { id: 'a', name: 'Jogador' } });
    const result = resolveActiveProfile(profiles);
    expect(profiles.renameProfile).toHaveBeenCalledWith('a', DEFAULT_PLAYER_NAME);
    expect(result.profile.name).toBe(DEFAULT_PLAYER_NAME);
  });
});
