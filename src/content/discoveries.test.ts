import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { discoveredWords, wordImage, journeyWords } from './discoveries.js';
import { WORD_BANK } from './word-bank.js';
import { WORD_PHASE_ORDER, wordPhaseId } from './word-phases.js';
import { MemoryStorageAdapter } from '../persistence/storage-adapter.js';
import { SaveStore } from '../persistence/save-store.js';
import { ProfileStore } from '../persistence/profile-store.js';
import { ProgressStore } from '../persistence/progress-store.js';

describe('word discoveries', () => {
  it('has a local, self-contained illustration for every word', () => {
    for (const word of WORD_BANK) {
      const path = `public${wordImage(word)}`;
      expect(existsSync(path), word.id).toBe(true);
      const svg = readFileSync(path, 'utf8');
      expect(svg).toContain('viewBox="0 0 128 128"');
      expect(svg).not.toMatch(/<script|<text|href=/);
    }
  });

  it('loads legacy discoveries and completed phases, isolates profiles, and preserves the next word after replay', () => {
    const adapter = new MemoryStorageAdapter();
    const saves = new SaveStore({ adapter });
    const profiles = new ProfileStore({ saves });
    const progress = new ProgressStore({ saves });
    const first = profiles.createProfile('Eloá');
    const second = profiles.createProfile('Nicolas');
    progress.recordDiscovery(first.id, 'bola');
    progress.recordDiscovery(first.id, 'removed-word');
    progress.completeLesson(first.id, wordPhaseId('gato'));
    const next = progress.getNextLesson(first.id, WORD_PHASE_ORDER);
    progress.completeLesson(first.id, wordPhaseId('gato'), { mistakes: 2 });
    expect(progress.getNextLesson(first.id, WORD_PHASE_ORDER)).toBe(next);
    expect(progress.getLessonProgress(first.id, wordPhaseId('gato'))?.stars).toBe(3);
    const reloaded = new ProfileStore({ saves: new SaveStore({ adapter }) });
    expect(discoveredWords(reloaded.getProfile(first.id)).map(w => w.id)).toEqual(['bola', 'gato']);
    expect(discoveredWords(reloaded.getProfile(second.id))).toEqual([]);
    expect(discoveredWords(null)).toEqual([]);
    progress.resetProgress(first.id);
    expect(discoveredWords(profiles.getProfile(first.id))).toEqual([]);
  });

  it('ignores unknown words and repeated completions in a journey', () => {
    expect(journeyWords(['sol', 'sol', 'unknown', 'bola', 'gato', 'pipa']).map(w => w.id)).toEqual(['sol', 'bola', 'gato']);
  });
});
