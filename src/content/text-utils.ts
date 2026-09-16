/**
 * Text normalisation for comparing the collected item with the lesson target.
 * Pure functions — no DOM, no locale-dependent case folding surprises.
 *
 * Portuguese content needs accent-insensitive comparison so a child who reads
 * "MAMÃE" still matches "MAMAE" typed/rendered without the tilde, and case
 * never matters ("a" vs "A").
 */

/** Normalise a label: Unicode NFC, lowercase, strip combining marks. */
export function normalize(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Compare two labels ignoring case and accents. */
export function equalsIgnoreAccent(a: unknown, b: unknown): boolean {
  const left = normalize(a);
  const right = normalize(b);
  return left !== '' && left === right;
}

/** Split a word into grapheme-ish characters (safe for accented letters). */
export function letters(word: unknown): string[] {
  return [...String(word ?? '')];
}

/** Format a label for display: uppercase, keeping accents. */
export function displayLabel(value: unknown): string {
  return String(value ?? '').toLocaleUpperCase('pt-BR');
}

/** Format elapsed seconds as MM:SS.d for speedrun timers. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const d = Math.floor((safe * 10) % 10);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${mm}:${ss}.${d}`;
}
