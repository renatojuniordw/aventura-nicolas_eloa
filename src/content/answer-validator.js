import { normalize, equalsIgnoreAccent } from './text-utils.js';

/**
 * Decides whether a collected item is the answer the lesson asked for.
 *
 * Pure and dependency-free so the rule is unit-tested independently of the
 * scene, the HUD and the celebration effects.
 */
export class AnswerValidator {
  /**
   * @param {{ target: string, variants?: string[] }} lesson
   */
  constructor(lesson) {
    this.target = lesson?.target ?? '';
    this.accepted = new Set(
      [this.target, ...(lesson?.variants ?? [])].map(normalize).filter(Boolean),
    );
  }

  /**
   * @param {{ label?: string, type?: string, kind?: string }} item
   * @returns {{ ok: boolean, collected: string, expected: string }}
   */
  validate(item) {
    const collected = normalize(item?.label);
    const ok = collected !== '' && this.accepted.has(collected);
    return { ok, collected, expected: normalize(this.target) };
  }

  /** Convenience for a raw label (used in tests and content tooling). */
  matches(label) {
    return this.validate({ label }).ok;
  }
}

/** Stock implementation used by content tooling and tests. */
export function validateLabel(label, lesson) {
  return new AnswerValidator(lesson).validate({ label });
}

export { equalsIgnoreAccent };
