import { describe, it, expect } from 'vitest';
import { ExploreRun, FUTURE_HINT_INTERVAL } from './explore-run.js';

const WORDS = [
  { id: 'bola', label: 'BOLA', fact: 'A bola é redonda.', category: 'brincadeiras' as const },
  { id: 'sol', label: 'SOL', fact: 'O Sol ilumina.', category: 'natureza' as const },
  { id: 'gato', label: 'GATO', fact: 'O gato faz miau!', category: 'animais' as const },
];
const CHECKPOINTS = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];

describe('ExploreRun', () => {
  it('starts on the first word, undiscovered, with the given clock', () => {
    const run = new ExploreRun(WORDS, CHECKPOINTS, 5);
    expect(run.currentWord.id).toBe('bola');
    expect(run.discovered).toBe(false);
    expect(run.elapsed).toBe(5);
    expect(run.progressText).toBe('1/3');
    expect(run.currentCheckpoint).toEqual(CHECKPOINTS[0]);
  });

  it('blocks any letter of the current word until the discovery marker is touched', () => {
    const run = new ExploreRun(WORDS);
    const letterB = { segmentIndex: 0, kind: 'letter', type: 'target', letterIndex: 0 };
    expect(run.isAhead(letterB)).toBe(true);
    run.markDiscovered();
    expect(run.isAhead(letterB)).toBe(false);
  });

  it('never blocks the discovery marker itself', () => {
    const run = new ExploreRun(WORDS);
    expect(run.isAhead({ segmentIndex: 0, kind: 'discovery' })).toBe(false);
  });

  it('blocks a target letter that comes later than the one currently expected', () => {
    const run = new ExploreRun(WORDS);
    run.markDiscovered();
    expect(run.isAhead({ segmentIndex: 0, kind: 'letter', type: 'target', letterIndex: 2 })).toBe(true);
    expect(run.isAhead({ segmentIndex: 0, kind: 'letter', type: 'target', letterIndex: 0 })).toBe(false);
  });

  it('never blocks a distractor letter of the current (discovered) word by letter order', () => {
    const run = new ExploreRun(WORDS);
    run.markDiscovered();
    expect(run.isAhead({ segmentIndex: 0, kind: 'letter', type: 'distractor' })).toBe(false);
  });

  it('treats only later words as ahead', () => {
    const run = new ExploreRun(WORDS);
    expect(run.isAhead({ segmentIndex: 1, kind: 'letter', type: 'target', letterIndex: 0 })).toBe(true);
    expect(run.isAhead({})).toBe(false);
  });

  it('advances the letter pointer and reports word completion', () => {
    const run = new ExploreRun(WORDS);
    run.markDiscovered();
    expect(run.currentLetter).toBe('B');
    expect(run.collectLetter()).toBe(false);
    expect(run.currentLetter).toBe('O');
    expect(run.collectLetter()).toBe(false);
    expect(run.collectLetter()).toBe(false);
    expect(run.collectLetter()).toBe(true); // 4th letter of BOLA completes it
  });

  it('advances word by word, resetting discovery and letter pointer, and stops on the last', () => {
    const run = new ExploreRun(WORDS, CHECKPOINTS);
    run.markDiscovered();
    run.collectLetter();
    expect(run.advance()).toBe(true);
    expect(run.currentWord.id).toBe('sol');
    expect(run.discovered).toBe(false);
    expect(run.currentLetterIndex).toBe(0);
    expect(run.currentCheckpoint).toEqual(CHECKPOINTS[1]);

    expect(run.advance()).toBe(true);
    expect(run.isOnLastWord).toBe(true);
    expect(run.advance()).toBe(false);
    expect(run.currentWord.id).toBe('gato');
    expect(run.progressText).toBe('3/3');
  });

  it('paces the hint to one per interval', () => {
    const run = new ExploreRun(WORDS);
    run.tick(1);
    expect(run.claimFutureHint()).toBe(true);
    run.tick(FUTURE_HINT_INTERVAL - 0.1);
    expect(run.claimFutureHint()).toBe(false);
    run.tick(0.2);
    expect(run.claimFutureHint()).toBe(true);
  });

  it('has no checkpoint when the course provides none', () => {
    expect(new ExploreRun(WORDS).currentCheckpoint).toBeUndefined();
  });
});
