import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandCurriculum, choicesForLesson, slugify } from './curriculum-model.js';
import { loadLevel } from './level-loader.js';
import { AnswerValidator } from './answer-validator.js';

/**
 * Content contract tests: they keep the curriculum, the generated level files
 * and the answer rule in agreement. This is what makes "add a lesson with zero
 * code changes" safe — a broken reference fails here, not in front of a child.
 */

const DIR = fileURLToPath(new URL('.', import.meta.url));
const LEVELS_DIR = join(DIR, 'levels');

const raw = JSON.parse(readFileSync(join(DIR, 'curriculum.json'), 'utf8'));
const { units, lessons } = expandCurriculum(raw);

const levelFiles = readdirSync(LEVELS_DIR).filter((file) => file.endsWith('.json'));
const levelsById = new Map(
  levelFiles.map((file) => {
    const data = JSON.parse(readFileSync(join(LEVELS_DIR, file), 'utf8'));
    return [data.id, { file, data }];
  }),
);

describe('curriculum model', () => {
  it('expands every pool entry into a lesson', () => {
    const expected = units.reduce((total, unit) => total + unit.pool.length, 0);
    expect(lessons).toHaveLength(expected);
    expect(lessons.length).toBeGreaterThanOrEqual(100);
  });

  it('produces unique lesson and level ids', () => {
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    expect(new Set(lessons.map((lesson) => lesson.levelId)).size).toBe(lessons.length);
  });

  it('gives every lesson a target and at least one variant', () => {
    for (const lesson of lessons) {
      expect(lesson.target, lesson.id).toBeTruthy();
      expect(lesson.variants.length, lesson.id).toBeGreaterThan(0);
      expect(lesson.variants, lesson.id).toContain(lesson.target);
      expect(lesson.objective, lesson.id).toContain(lesson.target);
    }
  });

  it('orders units and covers the expected categories', () => {
    const types = new Set(units.map((unit) => unit.type));
    expect(types).toContain('letter');
    expect(types).toContain('syllable');
    expect(types).toContain('word');
    const orders = units.map((unit) => unit.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('rejects duplicated unit ids', () => {
    expect(() => expandCurriculum({ units: [{ id: 'x' }, { id: 'x' }] })).toThrow(/Duplicated/);
  });
});

describe('choicesForLesson', () => {
  it('never offers the answer as a distractor', () => {
    for (const lesson of lessons) {
      const unit = units.find((candidate) => candidate.id === lesson.unitId);
      const choices = choicesForLesson(unit, lesson, 4);
      expect(choices, lesson.id).toContain(lesson.target);
      expect(
        choices.filter((label) => label === lesson.target),
        lesson.id,
      ).toHaveLength(1);
    }
  });

  it('caps the number of choices', () => {
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        expect(choicesForLesson(unit, lesson, 4).length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('varies the position of the answer across lessons', () => {
    const alphabet = units.find((unit) => unit.id === 'alfabeto');
    const positions = new Set(
      alphabet.lessons.map((lesson) =>
        choicesForLesson(alphabet, lesson, 4).indexOf(lesson.target),
      ),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it('handles pools smaller than the choice count', () => {
    const digrafos = units.find((unit) => unit.id === 'digrafos');
    const lesson = digrafos.lessons[0];
    const choices = choicesForLesson(digrafos, lesson, 4);
    expect(choices.length).toBeLessThanOrEqual(4);
    expect(choices).toContain(lesson.target);
  });
});

describe('generated level files', () => {
  it('ships one level file per lesson and nothing else', () => {
    expect(levelFiles.length).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(existsSync(join(LEVELS_DIR, `${lesson.levelId}.json`)), lesson.levelId).toBe(true);
    }
  });

  it('every level loads and passes validation', () => {
    for (const [, { data }] of levelsById) {
      expect(() => loadLevel(data), data.id).not.toThrow();
    }
  });

  it('every level contains exactly the lesson answer plus distractors', () => {
    for (const lesson of lessons) {
      const entry = levelsById.get(lesson.levelId);
      expect(entry, lesson.levelId).toBeTruthy();
      const level = loadLevel(entry.data);

      const targets = level.items.filter((item) => item.type === 'target');
      expect(targets, lesson.id).toHaveLength(1);

      const validator = new AnswerValidator(lesson);
      expect(validator.validate({ label: targets[0].label }).ok, lesson.id).toBe(true);

      const distractors = level.items.filter((item) => item.type === 'distractor');
      expect(distractors.length, lesson.id).toBeGreaterThan(0);
      for (const distractor of distractors) {
        expect(validator.validate({ label: distractor.label }).ok, lesson.id).toBe(false);
      }
    }
  });

  it('every level is reachable from the start (items inside the world)', () => {
    for (const [, { data }] of levelsById) {
      const level = loadLevel(data);
      for (const item of level.items) {
        expect(item.x, data.id).toBeGreaterThanOrEqual(0);
        expect(item.x + item.w, data.id).toBeLessThanOrEqual(level.worldWidth);
        expect(item.y, data.id).toBeGreaterThanOrEqual(0);
      }
      expect(data.playerStart.x, data.id).toBeLessThan(level.worldWidth);
    }
  });
});

describe('slugify', () => {
  it('strips accents and normalises separators', () => {
    expect(slugify('PÉ')).toBe('pe');
    expect(slugify('MAMÃE')).toBe('mamae');
    expect(slugify('Encontros Consonantais')).toBe('encontros-consonantais');
  });
});
