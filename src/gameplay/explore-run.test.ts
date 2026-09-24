import { describe, it, expect } from 'vitest';
import { ExploreRun, FUTURE_HINT_INTERVAL } from './explore-run.js';

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

  it('blocks target letters that come later than the expected one', () => {
    const run = new ExploreRun(GATO);
    const letter = (letterIndex: number) => ({ kind: 'letter', type: 'target', letterIndex });
    expect(run.isAhead(letter(0))).toBe(false);
    expect(run.isAhead(letter(1))).toBe(true);
    run.collectLetter();
    expect(run.isAhead(letter(1))).toBe(false);
    expect(run.isAhead(letter(2))).toBe(true);
  });

  it('never blocks distractors (they are simply wrong answers)', () => {
    const run = new ExploreRun(GATO);
    expect(run.isAhead({ kind: 'letter', type: 'distractor' })).toBe(false);
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

  it('claims the future-item hint at most once per hint window', () => {
    const run = new ExploreRun(GATO);
    run.tick(2);
    expect(run.claimFutureHint()).toBe(true);
    expect(run.claimFutureHint()).toBe(false);
    run.tick(FUTURE_HINT_INTERVAL + 0.1);
    expect(run.claimFutureHint()).toBe(true);
  });
});
