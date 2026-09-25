import { describe, it, expect } from 'vitest';
import words from './letter-reference-words.json';
import { getLetterReferenceWord } from './letter-reference.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

describe('letter reference words', () => {
  it('covers exactly A–Z with a non-empty word starting with its own letter', () => {
    expect(Object.keys(words).sort()).toEqual(ALPHABET);
    for (const letter of ALPHABET) {
      const word = getLetterReferenceWord(letter);
      expect(word, letter).toBeTruthy();
      expect(word.charAt(0).toUpperCase(), letter).toBe(letter);
    }
  });

  it('keeps accents and capitalized names from the file', () => {
    expect(getLetterReferenceWord('E')).toBe('Eloá');
    expect(getLetterReferenceWord('X')).toBe('xícara');
  });

  it('ignores case and surrounding spaces', () => {
    expect(getLetterReferenceWord('a')).toBe('amigo');
    expect(getLetterReferenceWord(' a ')).toBe('amigo');
  });

  it.each(['', '   ', 'BA', 'bola', '?', '1', 'Á', 'Ã', 'Ç', 'toString', '__proto__'])(
    'has no reference for %j',
    (target) => {
      expect(getLetterReferenceWord(target)).toBeUndefined();
    },
  );
});
