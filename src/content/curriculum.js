import raw from './curriculum.json';
import { expandCurriculum } from './curriculum-model.js';

/**
 * Runtime view of the curriculum: units and lessons expanded from the authored
 * pools, plus lookup helpers used by the scenes.
 */
const expanded = expandCurriculum(raw);

export const UNITS = expanded.units;
export const LESSONS = expanded.lessons;

/** Ordered lesson ids — the sequence used for unlocking. */
export const LESSON_ORDER = LESSONS.map((lesson) => lesson.id);

const LESSONS_BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
const UNITS_BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]));

export function getLesson(lessonId) {
  return LESSONS_BY_ID.get(lessonId) ?? null;
}

export function getUnit(unitId) {
  return UNITS_BY_ID.get(unitId) ?? null;
}

/** Lessons of a unit, in curriculum order. */
export function lessonsOfUnit(unitId) {
  return getUnit(unitId)?.lessons ?? [];
}
