import { describe, it, expect } from 'vitest';
import { normalize, equalsIgnoreAccent, displayLabel, letters, formatTime } from './text-utils.js';

describe('text-utils', () => {
  it('formats speedrun time as MM:SS.d', () => {
    expect(formatTime(0)).toBe('00:00.0');
    expect(formatTime(9.4)).toBe('00:09.4');
    expect(formatTime(65.2)).toBe('01:05.2');
    expect(formatTime(125.89)).toBe('02:05.8');
    expect(formatTime(-5)).toBe('00:00.0');
    expect(formatTime(null)).toBe('00:00.0');
  });
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
