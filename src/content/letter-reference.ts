import words from './letter-reference-words.json';

const REFERENCE_WORDS: Readonly<Record<string, string>> = words;

/**
 * Fixed example word for a single letter ("A" → "amigo"), used in spoken instructions.
 * Keys are matched exactly after trim + NFC + uppercase: accented letters, symbols and
 * multi-letter targets have no entry and return undefined.
 */
export function getLetterReferenceWord(target: string): string | undefined {
  const key = target.trim().normalize('NFC').toUpperCase();
  if (!Object.hasOwn(REFERENCE_WORDS, key)) return undefined;
  return REFERENCE_WORDS[key];
}
