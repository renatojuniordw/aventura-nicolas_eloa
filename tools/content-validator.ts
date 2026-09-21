/**
 * Build-time validation for proposed curriculum labels.
 *
 * Pure functions, shared by the content generator, the proposal applier and
 * the tests. These fill the gaps `loadLevel` does not cover: duplicates,
 * label format per unit type, syllable count and inappropriate words.
 */

import { normalize } from '../src/content/text-utils.js';

export type UnitType = 'letter' | 'syllable' | 'word';

export interface RejectedLabel {
  label: string;
  reason: string;
}

export interface ValidationResult {
  accepted: string[];
  rejected: RejectedLabel[];
}

export interface ValidationContext {
  unitId: string;
  type: UnitType;
  /** Labels already in the unit; proposals colliding with these are rejected. */
  existing: readonly string[];
}

/** Expected syllable count for word units that are defined by it. */
const SYLLABLES_BY_UNIT: Readonly<Record<string, number>> = {
  'palavras-monossilabas': 1,
  'palavras-dissilabas': 2,
};

/** Words unsuitable for a 5-7 year old audience (normalised, no accents). */
const BLOCKLIST: ReadonlySet<string> = new Set([
  'bosta', 'caca', 'merda', 'porra', 'puta', 'puto', 'cu', 'pau', 'pinto',
  'sexo', 'nudez', 'droga', 'morte', 'matar', 'arma', 'bala', 'sangue',
  'bebado', 'cachaca', 'cerveja', 'idiota', 'burro', 'gorda', 'gordo',
]);

const FORMAT_BY_TYPE: Readonly<Record<UnitType, RegExp>> = {
  letter: /^\p{L}$/u,
  syllable: /^\p{L}{2,3}$/u,
  word: /^\p{L}{2,12}$/u,
};

const STRONG_VOWELS = 'aeoáéóâêôàãõ';
const ACCENTED_WEAK = 'íú';
const VOWELS = `${STRONG_VOWELS}iuíú`;

/**
 * Heuristic syllable count for Portuguese words. It handles silent `u` in
 * qu/gu, nasal diphthongs (ão, õe, ãe) and hiatus, but is not a full
 * syllabifier; treat it as a sanity check, not ground truth.
 */
export function countSyllables(word: string): number {
  let text = word
    .normalize('NFC')
    .toLowerCase()
    .replace(/([qg])u(?=[eiéêí])/g, '$1');
  text = text.replace(/ão|ãe|õe|ãi/g, 'a');

  let count = 0;
  let inGroup = false;
  let previous = '';
  for (const char of text) {
    if (!VOWELS.includes(char)) {
      inGroup = false;
      previous = '';
      continue;
    }
    const startsNucleus =
      !inGroup ||
      (STRONG_VOWELS.includes(previous) && STRONG_VOWELS.includes(char)) ||
      ACCENTED_WEAK.includes(char) ||
      ACCENTED_WEAK.includes(previous);
    if (startsNucleus) count += 1;
    inGroup = true;
    previous = char;
  }
  return count;
}

/** Return the reason a label is invalid, or null when it is acceptable. */
export function rejectionReason(label: string, ctx: ValidationContext): string | null {
  if (typeof label !== 'string' || label.trim() === '') return 'vazio';
  if (label !== label.trim()) return 'espaços nas pontas';
  if (label !== label.toLocaleUpperCase('pt-BR')) return 'não está em MAIÚSCULAS';
  if (!FORMAT_BY_TYPE[ctx.type].test(label)) return `formato inválido para ${ctx.type}`;
  if (BLOCKLIST.has(normalize(label))) return 'palavra na lista de bloqueio';

  const expected = SYLLABLES_BY_UNIT[ctx.unitId];
  if (ctx.type === 'word' && expected !== undefined && countSyllables(label) !== expected) {
    return `esperado ${expected} sílaba(s), contou ${countSyllables(label)}`;
  }
  return null;
}

/**
 * Validate a batch of proposed labels. Order is preserved; duplicates (against
 * the existing pool or earlier proposals, ignoring case and accents) are
 * rejected. `VOVÔ` and `VOVÓ` are intentionally distinct only if accents differ
 * in the pool today; accent-only collisions are still flagged here for review.
 */
export function validateProposals(
  proposed: readonly string[],
  ctx: ValidationContext,
): ValidationResult {
  const seen = new Set(ctx.existing.map(normalize));
  const accepted: string[] = [];
  const rejected: RejectedLabel[] = [];

  for (const label of proposed) {
    const reason = rejectionReason(label, ctx);
    if (reason) {
      rejected.push({ label, reason });
      continue;
    }
    const key = normalize(label);
    if (seen.has(key)) {
      rejected.push({ label, reason: 'duplicada' });
      continue;
    }
    seen.add(key);
    accepted.push(label);
  }
  return { accepted, rejected };
}
