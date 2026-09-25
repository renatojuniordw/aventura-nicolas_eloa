import { describe, it, expect } from 'vitest';
import { ExploreRun } from './explore-run.js';

const GATO = { id: 'gato', label: 'GATO', fact: 'O gato faz miau!', category: 'animais' as const };
const REGADOR = { id: 'regador', label: 'REGADOR', fact: 'Rega as plantas.', category: 'natureza' as const };

describe('ExploreRun', () => {
  it('starts on the first letter of the word, with the given clock and trail position', () => {
    const run = new ExploreRun(GATO, { position: 3, total: 30 }, 5);
    expect(run.currentWord.id).toBe('gato');
    expect(run.currentLetterIndex).toBe(0);
    expect(run.currentLetter).toBe('G');
    expect(run.elapsed).toBe(5);
    expect(run.progressText).toBe('3/30');
  });

  it('spells the whole word letter by letter and reports completion on the last one', () => {
    const run = new ExploreRun(GATO);
    expect(run.collectLetter()).toBe(false);
    expect(run.currentLetter).toBe('A');
    expect(run.collectLetter()).toBe(false);
    expect(run.collectLetter()).toBe(false);
    expect(run.collectLetter()).toBe(true);
  });

  it('handles repeated letters by position (REGADOR has two Rs)', () => {
    const run = new ExploreRun(REGADOR);
    const seen: string[] = [];
    let done = false;
    while (!done) {
      seen.push(run.currentLetter);
      done = run.collectLetter();
    }
    expect(seen.join('')).toBe('REGADOR');
    expect(run.currentLetterIndex).toBe(7);
  });
});
