import { WORD_BANK, type WordEntry } from './word-bank.js';
import { wordPhaseId } from './word-phases.js';
import type { Profile } from '../persistence/migration.js';

export const JOURNEY_LENGTH = 3;

export function wordImage(word: WordEntry): string {
  return `/assets/words/${word.id}.svg`;
}

/** Legacy discoveries are visited words, not evidence of completed spelling. */
export function discoveredWords(profile: Profile | null): WordEntry[] {
  return WORD_BANK.filter(word => profile?.discoveries?.includes(word.id) ||
    profile?.progress[wordPhaseId(word.id)]?.completed);
}

export function journeyWords(ids: readonly string[]): WordEntry[] {
  return [...new Set(ids)].flatMap(id => {
    const word = WORD_BANK.find(entry => entry.id === id);
    return word ? [word] : [];
  }).slice(0, JOURNEY_LENGTH);
}
