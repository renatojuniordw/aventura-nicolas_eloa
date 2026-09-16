import { normalize, equalsIgnoreAccent } from './text-utils.js';

interface LessonLike {
  target: string;
  variants?: string[];
}

interface ItemLike {
  label?: string;
  type?: string;
  kind?: string;
}

/**
 * Decides whether a collected item is the answer the lesson asked for.
 *
 * Pure and dependency-free so the rule is unit-tested independently of the
 * scene, the HUD and the celebration effects.
 */
export class AnswerValidator {
  target: string;
  accepted: Set<string>;

  constructor(lesson: LessonLike) {
    this.target = lesson?.target ?? '';
    this.accepted = new Set(
      [this.target, ...(lesson?.variants ?? [])].map(normalize).filter(Boolean),
    );
  }

  validate(item: ItemLike): { ok: boolean; collected: string; expected: string } {
    const collected = normalize(item?.label);
    const ok = collected !== '' && this.accepted.has(collected);
    return { ok, collected, expected: normalize(this.target) };
  }

  /** Convenience for a raw label (used in tests and content tooling). */
  matches(label: string): boolean {
    return this.validate({ label }).ok;
  }
}

/** Stock implementation used by content tooling and tests. */
export function validateLabel(label: string, lesson: LessonLike) {
  return new AnswerValidator(lesson).validate({ label });
}

export { equalsIgnoreAccent };
