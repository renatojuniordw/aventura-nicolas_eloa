import { describe, it, expect } from 'vitest';
import { normalize, equalsIgnoreAccent, displayLabel, letters } from './text-utils.js';

describe('text-utils', () => {
  it('normalizes case', () => {
    expect(normalize('BOLA')).toBe('bola');
    expect(normalize('bola')).toBe('bola');
  });

  it('strips accents so mamãe equals mamae', () => {
    expect(normalize('MAMÃE')).toBe('mamae');
    expect(equalsIgnoreAccent('MAMÃE', 'MAMAE')).toBe(true);
  });

  it('handles cedilla and acute accents', () => {
    expect(normalize('PÉ')).toBe('pe');
    expect(normalize('AÇÃO')).toBe('acao');
    expect(equalsIgnoreAccent('ação', 'ACAO')).toBe(true);
  });

  it('never matches empty strings', () => {
    expect(equalsIgnoreAccent('', '')).toBe(false);
    expect(equalsIgnoreAccent(null, 'A')).toBe(false);
    expect(equalsIgnoreAccent(undefined, undefined)).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(normalize('  SOL  ')).toBe('sol');
  });

  it('ignores non-string input', () => {
    expect(normalize(42)).toBe('');
    expect(normalize({})).toBe('');
  });

  it('formats display labels in uppercase keeping accents', () => {
    expect(displayLabel('mamãe')).toBe('MAMÃE');
  });

  it('splits words into letters without breaking accents', () => {
    expect(letters('PÉ')).toEqual(['P', 'É']);
  });
});
