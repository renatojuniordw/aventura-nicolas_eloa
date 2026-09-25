import { describe, it, expect } from 'vitest';
import { SpeedrunRun } from './speedrun-run.js';

const ALPHABET = ['A', 'B', 'C'];
const CHECKPOINTS = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];

describe('SpeedrunRun', () => {
  it('starts on the first letter with the given clock', () => {
    const run = new SpeedrunRun(ALPHABET, CHECKPOINTS, 5);
    expect(run.currentLetter).toBe('A');
    expect(run.elapsed).toBe(5);
    expect(run.progressText).toBe('1/3');
    expect(run.currentCheckpoint).toEqual(CHECKPOINTS[0]);
  });

  it('advances letter by letter and stops on the last one', () => {
    const run = new SpeedrunRun(ALPHABET, CHECKPOINTS);
    expect(run.advance()).toBe(true);
    expect(run.advance()).toBe(true);
    expect(run.currentLetter).toBe('C');
    expect(run.isOnLastLetter).toBe(true);
    expect(run.advance()).toBe(false);
    expect(run.currentLetter).toBe('C');
    expect(run.progressText).toBe('3/3');
  });

  it('accumulates elapsed time', () => {
    const run = new SpeedrunRun(ALPHABET);
    run.tick(0.5);
    run.tick(0.25);
    expect(run.elapsed).toBeCloseTo(0.75);
  });

  it('has no checkpoint when the course provides none', () => {
    expect(new SpeedrunRun(ALPHABET).currentCheckpoint).toBeUndefined();
  });
});
