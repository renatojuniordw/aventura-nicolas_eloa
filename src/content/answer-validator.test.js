import { describe, it, expect } from 'vitest';
import { AnswerValidator, validateLabel } from './answer-validator.js';

describe('AnswerValidator', () => {
  it('accepts the exact lesson target', () => {
    const validator = new AnswerValidator({ target: 'A' });
    expect(validator.validate({ label: 'A' }).ok).toBe(true);
  });

  it('is case and accent insensitive', () => {
    const validator = new AnswerValidator({ target: 'MAMÃE' });
    expect(validator.validate({ label: 'mamãe' }).ok).toBe(true);
    expect(validator.validate({ label: 'MAMAE' }).ok).toBe(true);
  });

  it('accepts declared variants', () => {
    const validator = new AnswerValidator({ target: 'A', variants: ['A', 'a', 'á'] });
    expect(validator.matches('á')).toBe(true);
  });

  it('rejects distractors', () => {
    const validator = new AnswerValidator({ target: 'A' });
    expect(validator.validate({ label: 'E' }).ok).toBe(false);
    expect(validator.validate({ label: 'E' }).expected).toBe('a');
  });

  it('rejects an empty or missing label', () => {
    const validator = new AnswerValidator({ target: 'BOLA' });
    expect(validator.validate({ label: '' }).ok).toBe(false);
    expect(validator.validate({}).ok).toBe(false);
  });

  it('does not confuse partial syllables', () => {
    const validator = new AnswerValidator({ target: 'BA' });
    expect(validator.matches('BA')).toBe(true);
    expect(validator.matches('B')).toBe(false);
    expect(validator.matches('BOLA')).toBe(false);
  });

  it('exposes a stock helper', () => {
    expect(validateLabel('SOL', { target: 'SOL' }).ok).toBe(true);
    expect(validateLabel('MAR', { target: 'SOL' }).ok).toBe(false);
  });
});
