import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from './storage-adapter.js';
import { SaveStore } from './save-store.js';
import { ProfileStore } from './profile-store.js';
import { ProgressStore } from './progress-store.js';

describe('learning history', () => {
  it('retains recent answers independently per lesson and profile and resets them', () => {
    const saves = new SaveStore({ adapter: new MemoryStorageAdapter() });
    const profiles = new ProfileStore({ saves });
    const first = profiles.createProfile('Eloá');
    const second = profiles.createProfile('Nicolas');
    const progress = new ProgressStore({ saves });
    for (let i = 0; i < 12; i++) progress.recordLessonAnswer(first.id, 'alfabeto-a', i > 6, 'B');
    const loaded = profiles.getProfile(first.id);
    expect(loaded.learning['alfabeto-a'].recent).toEqual([false, false, false, true, true, true, true, true]);
    expect(loaded.learning['alfabeto-a'].confusedWith).toBe('B');
    expect(profiles.getProfile(second.id).learning).toEqual({});
    progress.resetProgress(first.id);
    expect(profiles.getProfile(first.id).learning).toEqual({});
  });
  it('normalizes malformed histories without losing existing progress', () => {
    const saves = new SaveStore({ adapter: new MemoryStorageAdapter() });
    const profiles = new ProfileStore({ saves });
    const profile = profiles.createProfile('Eloá');
    saves.update(doc => {
      doc.profiles[profile.id].learning = { a: { recent: [false, 'bad', true], confusedWith: 3 }, b: null };
    });
    expect(profiles.getProfile(profile.id).learning).toEqual({ a: { recent: [false, true], confusedWith: null } });
  });
});
