/**
 * Expands the authored curriculum into concrete lessons.
 *
 * The curriculum file lists *pools* of labels per unit (the alphabet, a
 * syllabic family, a word list). This module derives one lesson per label and
 * the distractors shown alongside the answer.
 *
 * Both the runtime and the level generator use these functions, so the content
 * that ships and the content that is validated can never drift apart.
 */

import { normalize } from './text-utils.js';

export interface RawUnit {
  id: string;
  title: string;
  order?: number;
  type?: string;
  icon?: string;
  pool?: string[];
  distractorPool?: string[];
  objectiveTemplate?: string;
}

export interface RawCurriculum {
  units: RawUnit[];
}

export interface Lesson {
  id: string;
  unitId: string;
  unitTitle: string;
  type: string;
  target: string;
  variants: string[];
  objective: string;
  levelId: string;
  index: number;
}

export interface Unit {
  id: string;
  title: string;
  order: number;
  type: string;
  icon: string;
  pool: string[];
  distractorPool: string[];
  objectiveTemplate: string;
  lessons: Lesson[];
}

function isRawCurriculum(raw: unknown): raw is RawCurriculum {
  return Boolean(raw) && Array.isArray((raw as { units?: unknown }).units);
}

/** URL/file-safe slug that keeps the label readable. */
export function slugify(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function expandCurriculum(raw: unknown): { units: Unit[]; lessons: Lesson[] } {
  if (!isRawCurriculum(raw)) {
    throw new Error('Curriculum must expose a "units" array');
  }
  assertUniqueUnitIds(raw.units);

  const units: Unit[] = [...raw.units]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((unit) => ({
      id: unit.id,
      title: unit.title,
      order: unit.order ?? 0,
      type: unit.type ?? 'letter',
      icon: unit.icon ?? '',
      pool: [...(unit.pool ?? [])],
      distractorPool: [...(unit.distractorPool ?? unit.pool ?? [])],
      objectiveTemplate: unit.objectiveTemplate ?? 'Encontre {target}',
      lessons: buildLessons(unit),
    }));

  return { units, lessons: units.flatMap((unit) => unit.lessons) };
}

/**
 * Build the ordered choice labels for a lesson: the answer plus distractors,
 * with the answer rotated to a position that varies between lessons so it is
 * never always in the same slot.
 *
 * @param unit expanded unit (needs `pool`/`distractorPool`)
 * @param lesson expanded lesson
 * @param count maximum number of choices (including the answer)
 */
export function choicesForLesson(unit: Unit, lesson: Lesson, count = 4): string[] {
  // Exclude anything that normalises to the answer: VOVÔ and VOVÓ are the same
  // word for the answer rule, so one must never appear as a distractor.
  const answer = normalize(lesson.target);
  const isDistinct = (label: string) => label !== lesson.target && normalize(label) !== answer;

  const pool = (unit.pool ?? []).filter(isDistinct);
  const extras = (unit.distractorPool ?? []).filter(
    (label) => isDistinct(label) && !pool.includes(label),
  );
  const candidates = [...pool, ...extras];

  const distractors: string[] = [];
  for (let step = 0; step < candidates.length && distractors.length < count - 1; step += 1) {
    const label = candidates[(lesson.index + step) % candidates.length];
    if (!distractors.includes(label)) distractors.push(label);
  }

  const labels = [lesson.target, ...distractors];
  if (labels.length <= 1) return labels;

  const shift = lesson.index % labels.length;
  return [...labels.slice(shift), ...labels.slice(0, shift)];
}

function buildLessons(unit: RawUnit): Lesson[] {
  const usedSlugs = new Set<string>();
  return (unit.pool ?? []).map((target, index) => {
    // Labels that differ only by accent (VOVÔ/VOVÓ) collapse to the same slug,
    // which would overwrite one level with another. Disambiguate with a suffix.
    const base = slugify(target);
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);

    const type = unit.type ?? 'letter';
    return {
      id: `${unit.id}-${slug}`,
      unitId: unit.id,
      unitTitle: unit.title,
      type,
      target,
      variants: uniqueLabels([target, String(target).toLowerCase()]),
      objective: (unit.objectiveTemplate ?? 'Encontre {target}').replaceAll('{target}', target),
      levelId: `fase-${unit.id}-${slug}`,
      index,
    };
  });
}

function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels.filter(Boolean))];
}

function assertUniqueUnitIds(units: RawUnit[]): void {
  const seen = new Set<string>();
  for (const unit of units) {
    if (!unit.id) throw new Error('Every curriculum unit requires an "id"');
    if (seen.has(unit.id)) throw new Error(`Duplicated curriculum unit id: ${unit.id}`);
    seen.add(unit.id);
  }
}
