import { describe, it, expect, vi } from 'vitest';
import { MemoryStorageAdapter } from './storage-adapter.js';
import { SaveStore } from './save-store.js';
import { ProfileStore } from './profile-store.js';
import { ProgressStore, starsForMistakes } from './progress-store.js';
import { EventBus, Events } from '../core/event-bus.js';
import { STORAGE_KEY, DEGRADED_KEY } from './storage-keys.js';

function setup(initial = {}) {
  const adapter = new MemoryStorageAdapter(initial);
  let clock = 1000;
  const saves = new SaveStore({ adapter, now: () => (clock += 1) });
  return { adapter, saves };
}

describe('SaveStore', () => {
  it('starts from an empty document when nothing is stored', () => {
    const { saves } = setup();
    expect(saves.read().profiles).toEqual({});
    expect(saves.lastRecoveryReason).toBeNull();
  });

  it('round-trips a document', () => {
    const { saves } = setup();
    saves.update((doc) => {
      doc.activeProfileId = 'p-1';
      doc.profiles['p-1'] = { id: 'p-1', name: 'Ana', progress: {}, stats: {} };
    });
    expect(saves.read().profiles['p-1'].name).toBe('Ana');
  });

  it('keeps a degraded copy of an unreadable save', () => {
    const { adapter, saves } = setup({ [STORAGE_KEY]: '{{{ broken' });
    const doc = saves.read();
    expect(doc.profiles).toEqual({});
    expect(saves.lastRecoveryReason).toBe('unreadable');
    expect(adapter.read(DEGRADED_KEY)).toBe('{{{ broken');
  });

  it('persists the upgraded document after a migration', () => {
    const { adapter, saves } = setup({ [STORAGE_KEY]: JSON.stringify({ profileName: 'Léo', progress: {} }) });
    saves.read();
    const persisted = JSON.parse(adapter.read(STORAGE_KEY));
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.profiles['p-legacy'].name).toBe('Léo');
  });
});

describe('ProfileStore', () => {
  it('creates profiles with a default character and activates the newest', () => {
    const { saves } = setup();
    const profiles = new ProfileStore({ saves, idFactory: () => 'p-1' });
    const profile = profiles.createProfile('  Bia  ');

    expect(profile.name).toBe('Bia');
    expect(profiles.listProfiles()).toHaveLength(1);
    expect(profiles.getActiveProfile().id).toBe('p-1');
  });

  it('falls back to a default name for blank input', () => {
    const { saves } = setup();
    const profiles = new ProfileStore({ saves, idFactory: () => 'p-1' });
    expect(profiles.createProfile('   ').name).toBe('Jogador');
  });

  it('switch, rename and change character', () => {
    const { saves } = setup();
    let counter = 0;
    const profiles = new ProfileStore({ saves, idFactory: () => `p-${++counter}` });
    profiles.createProfile('Ana');
    profiles.createProfile('Léo');

    profiles.setActiveProfile('p-1');
    expect(profiles.getActiveProfile().name).toBe('Ana');

    profiles.renameProfile('p-1', 'Ana Clara');
    profiles.setCharacter('p-1', 'char-nicolas');
    const updated = profiles.getProfile('p-1');
    expect(updated.name).toBe('Ana Clara');
    expect(updated.characterId).toBe('char-nicolas');
  });

  it('ignores an unknown character id', () => {
    const { saves } = setup();
    const profiles = new ProfileStore({ saves, idFactory: () => 'p-1' });
    profiles.createProfile('Ana');
    profiles.setCharacter('p-1', 'dragon');
    expect(profiles.getProfile('p-1').characterId).not.toBe('dragon');
  });

  it('deleting the active profile falls back to another one', () => {
    const { saves } = setup();
    let counter = 0;
    const profiles = new ProfileStore({ saves, idFactory: () => `p-${++counter}` });
    profiles.createProfile('Ana');
    profiles.createProfile('Léo');

    profiles.deleteProfile('p-2');
    expect(profiles.listProfiles()).toHaveLength(1);
    expect(profiles.getActiveProfile().id).toBe('p-1');
  });
});

describe('ProgressStore', () => {
  function setupProgress() {
    const { saves } = setup();
    const profiles = new ProfileStore({ saves, idFactory: () => 'p-1' });
    profiles.createProfile('Ana');
    const bus = new EventBus();
    const progress = new ProgressStore({ saves, bus, now: () => 5000 });
    return { saves, progress, bus };
  }

  it('awards stars by mistakes made', () => {
    expect(starsForMistakes(0)).toBe(3);
    expect(starsForMistakes(1)).toBe(2);
    expect(starsForMistakes(4)).toBe(1);
  });

  it('marks a lesson complete and emits PROGRESS_SAVED', () => {
    const { progress, bus } = setupProgress();
    const onSaved = vi.fn();
    bus.on(Events.PROGRESS_SAVED, onSaved);

    const entry = progress.completeLesson('p-1', 'letra-a', { mistakes: 1 });
    expect(entry.completed).toBe(true);
    expect(entry.stars).toBe(2);
    expect(progress.isLessonComplete('p-1', 'letra-a')).toBe(true);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('keeps the best result across attempts', () => {
    const { progress } = setupProgress();
    progress.completeLesson('p-1', 'letra-a', { mistakes: 3 });
    const entry = progress.completeLesson('p-1', 'letra-a', { mistakes: 0 });
    expect(entry.stars).toBe(3);
    expect(entry.mistakes).toBe(0);

    // A worse later attempt must not downgrade the record.
    const after = progress.completeLesson('p-1', 'letra-a', { mistakes: 5 });
    expect(after.stars).toBe(3);
    expect(after.mistakes).toBe(0);
  });

  it('counts answers in the statistics', () => {
    const { saves, progress } = setupProgress();
    progress.recordAnswer('p-1', true);
    progress.recordAnswer('p-1', true);
    progress.recordAnswer('p-1', false);
    expect(saves.read().profiles['p-1'].stats).toEqual({ correct: 2, wrong: 1 });
  });

  it('unlocks lessons sequentially', () => {
    const { progress } = setupProgress();
    const order = ['l1', 'l2', 'l3', 'l4'];

    expect(progress.getUnlockedLessonIds('p-1', order)).toEqual(['l1']);
    expect(progress.getNextLesson('p-1', order)).toBe('l1');

    progress.completeLesson('p-1', 'l1', { mistakes: 0 });
    expect(progress.getUnlockedLessonIds('p-1', order)).toEqual(['l1', 'l2']);
    expect(progress.getNextLesson('p-1', order)).toBe('l2');

    expect(progress.completedCount('p-1')).toBe(1);
  });

  it('reports no next lesson when everything is complete', () => {
    const { progress } = setupProgress();
    progress.completeLesson('p-1', 'l1', {});
    expect(progress.getNextLesson('p-1', ['l1'])).toBeNull();
  });

  it('resets a profile progress', () => {
    const { progress } = setupProgress();
    progress.completeLesson('p-1', 'l1', { mistakes: 0 });
    progress.recordAnswer('p-1', false);
    progress.resetProgress('p-1');
    expect(progress.completedCount('p-1')).toBe(0);
    expect(progress.isLessonComplete('p-1', 'l1')).toBe(false);
  });

  it('isolates progress between profiles', () => {
    const { saves } = setup();
    let counter = 0;
    const profiles = new ProfileStore({ saves, idFactory: () => `p-${++counter}` });
    profiles.createProfile('Ana');
    profiles.createProfile('Léo');
    const progress = new ProgressStore({ saves });

    progress.completeLesson('p-1', 'l1', { mistakes: 0 });
    expect(progress.isLessonComplete('p-1', 'l1')).toBe(true);
    expect(progress.isLessonComplete('p-2', 'l1')).toBe(false);
  });
});
