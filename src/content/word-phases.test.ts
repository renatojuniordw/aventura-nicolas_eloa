import { describe, it, expect } from 'vitest';
import { WORD_BANK } from './word-bank.js';
import {
  WORD_PHASE_ORDER,
  getWordByPhaseId,
  wordPhaseId,
  wordPhasePosition,
} from './word-phases.js';

describe('word phases', () => {
  it('has one unique phase per word of the bank', () => {
    expect(WORD_PHASE_ORDER).toHaveLength(WORD_BANK.length);
    expect(new Set(WORD_PHASE_ORDER).size).toBe(WORD_BANK.length);
  });

  it('orders phases from the shortest word to the longest', () => {
    const lengths = WORD_PHASE_ORDER.map((id) => Array.from(getWordByPhaseId(id)!.label).length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  it('round-trips phase ids and rejects ids that are not word phases', () => {
    expect(getWordByPhaseId(wordPhaseId('gato'))?.label).toBe('GATO');
    expect(getWordByPhaseId('alfabeto-a')).toBeNull();
    expect(getWordByPhaseId(undefined)).toBeNull();
  });

  it('reports the 1-based trail position', () => {
    expect(wordPhasePosition(WORD_PHASE_ORDER[0])).toEqual({ position: 1, total: WORD_BANK.length });
    expect(wordPhasePosition(WORD_PHASE_ORDER.at(-1)!).position).toBe(WORD_BANK.length);
  });
});
