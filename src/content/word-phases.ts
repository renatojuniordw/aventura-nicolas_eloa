import { WORD_BANK, type WordEntry } from './word-bank.js';

/**
 * "Explorar" trail: every word of the bank is one phase, easiest (shortest)
 * first. Phase ids are namespaced (`palavra-<id>`) so they can live in the same
 * per-profile progress map as the curriculum lessons without colliding.
 */
const PHASE_PREFIX = 'palavra-';

const SORTED_WORDS: WordEntry[] = WORD_BANK.map((word, index) => ({ word, index }))
  .sort((a, b) => Array.from(a.word.label).length - Array.from(b.word.label).length || a.index - b.index)
  .map(({ word }) => word);

export const WORD_PHASE_ORDER: string[] = SORTED_WORDS.map((word) => wordPhaseId(word.id));

export function wordPhaseId(wordId: string): string {
  return `${PHASE_PREFIX}${wordId}`;
}

/** The word behind a phase id, or null when the id is not a word phase. */
export function getWordByPhaseId(phaseId: string | null | undefined): WordEntry | null {
  if (!phaseId?.startsWith(PHASE_PREFIX)) return null;
  const wordId = phaseId.slice(PHASE_PREFIX.length);
  return WORD_BANK.find((word) => word.id === wordId) ?? null;
}

/** 1-based position of a phase in the trail, with the trail length. */
export function wordPhasePosition(phaseId: string): { position: number; total: number } {
  const index = WORD_PHASE_ORDER.indexOf(phaseId);
  return { position: index < 0 ? 1 : index + 1, total: WORD_PHASE_ORDER.length };
}
