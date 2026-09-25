import { describe, it, expect } from 'vitest';
import { supportPolicy } from './support-policy.js';

describe('supportPolicy', () => {
  it('keeps today\'s rules at the standard level', () => {
    const policy = supportPolicy('standard');
    expect(policy.wrongAnswerCostsHeart).toBe(true);
    expect(policy.highlightTarget).toBe(false);
    expect(policy.repeatInstructionAfter).toBeNull();
    expect(policy.distractorsPerSegment).toBe(3);
    expect(policy.allowNeighbourLetters).toBe(false);
  });

  it('assisted: points at the letter, repeats the instruction and forgives reading mistakes', () => {
    const policy = supportPolicy('assisted');
    expect(policy.wrongAnswerCostsHeart).toBe(false);
    expect(policy.highlightTarget).toBe(true);
    expect(policy.repeatInstructionAfter).toBeGreaterThan(0);
    expect(policy.narrateNextLetter).toBe(true);
    expect(policy.distractorsPerSegment).toBeLessThan(3);
  });

  it('challenge: more and closer distractors, no spoken next letter', () => {
    const policy = supportPolicy('challenge');
    expect(policy.wrongAnswerCostsHeart).toBe(true);
    expect(policy.narrateNextLetter).toBe(false);
    expect(policy.distractorsPerSegment).toBeGreaterThan(3);
    expect(policy.allowNeighbourLetters).toBe(true);
  });

  it('falls back to standard for unknown or missing values', () => {
    expect(supportPolicy(undefined).level).toBe('standard');
    expect(supportPolicy('turbo').level).toBe('standard');
  });
});
