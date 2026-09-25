/** Same values the experience settings store saves (`persistence/experience-settings-store.ts`). */
export type SupportLevel = 'assisted' | 'standard' | 'challenge';

/**
 * What the "Nível de apoio" setting changes in a run. Pedagogical help
 * (pointing at the letter, repeating the instruction, not costing a heart for
 * a reading mistake) is kept apart from motor difficulty: hazards and falls
 * behave the same at every level.
 */
export interface SupportPolicy {
  level: SupportLevel;
  /** A wrong letter costs a heart. Off when assisted: practice without losing for a reading mistake. */
  wrongAnswerCostsHeart: boolean;
  /** An arrow over the letter to find, plus an edge pointer with its name while it is off-screen. */
  highlightTarget: boolean;
  /** Seconds without progress before the instruction is spoken again on its own; null never. */
  repeatInstructionAfter: number | null;
  /** Speak the next letter while spelling a word. */
  narrateNextLetter: boolean;
  /** Distractors per regular segment of the endless world. */
  distractorsPerSegment: number;
  /** Alphabet marathon: letters next to the target may show up as distractors. */
  allowNeighbourLetters: boolean;
}

const POLICIES: Record<SupportLevel, SupportPolicy> = {
  assisted: {
    level: 'assisted',
    wrongAnswerCostsHeart: false,
    highlightTarget: true,
    repeatInstructionAfter: 10,
    narrateNextLetter: true,
    distractorsPerSegment: 2,
    allowNeighbourLetters: false,
  },
  standard: {
    level: 'standard',
    wrongAnswerCostsHeart: true,
    highlightTarget: false,
    repeatInstructionAfter: null,
    narrateNextLetter: true,
    distractorsPerSegment: 3,
    allowNeighbourLetters: false,
  },
  challenge: {
    level: 'challenge',
    wrongAnswerCostsHeart: true,
    highlightTarget: false,
    repeatInstructionAfter: null,
    narrateNextLetter: false,
    distractorsPerSegment: 4,
    allowNeighbourLetters: true,
  },
};

/** The policy for `level`; unknown values fall back to the standard one. */
export function supportPolicy(level: string | null | undefined): SupportPolicy {
  return POLICIES[level as SupportLevel] ?? POLICIES.standard;
}
