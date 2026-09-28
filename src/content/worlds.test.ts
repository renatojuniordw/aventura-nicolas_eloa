import { describe, expect, it } from 'vitest';
import { LESSON_ORDER, UNITS } from './curriculum.js';
import { WORLDS, buildWorldMap, worldOfUnit } from './worlds.js';
import { REVIEWED_SYLLABLE_WORDS, syllablesOf } from './syllables.js';
import { WORD_BANK } from './word-bank.js';
import { normalize } from './text-utils.js';

describe('worlds (docs/20 §4 L1)', () => {
  it('places every curriculum unit in exactly one world, with no unknown unit', () => {
    const listed = WORLDS.flatMap((world) => world.unitIds);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(UNITS.map((unit) => unit.id).sort());
    expect(worldOfUnit('silabas-b')?.id).toBe('pomar-das-silabas');
  });

  it('keeps the worlds in curriculum order, so the trail reads front to back', () => {
    const firstOrder = WORLDS.map((world) => Math.min(...world.unitIds.map((id) => UNITS.find((u) => u.id === id)!.order)));
    expect(firstOrder).toEqual([...firstOrder].sort((a, b) => a - b));
  });

  it('marks done, next and locked lessons and the current world', () => {
    const done = new Set(LESSON_ORDER.slice(0, 26));
    const map = buildWorldMap({ units: UNITS, isComplete: (id) => done.has(id), nextLessonId: LESSON_ORDER[26] });
    const [garden, orchard] = map;
    expect(garden).toMatchObject({ done: 26, total: 26, current: false });
    expect(orchard.current).toBe(true);
    const [first, second] = orchard.units[0].lessons;
    expect(first).toMatchObject({ target: 'BA', state: 'next', playable: true });
    expect(second).toMatchObject({ state: 'locked', playable: false });
    expect(garden.units[0].lessons.every((lesson) => lesson.state === 'done' && lesson.playable)).toBe(true);
  });

  it('free practice makes every lesson playable without marking it done', () => {
    const map = buildWorldMap({ units: UNITS, isComplete: () => false, nextLessonId: LESSON_ORDER[0], freePractice: true });
    const lessons = map.flatMap((world) => world.units.flatMap((unit) => unit.lessons));
    expect(lessons.every((lesson) => lesson.playable)).toBe(true);
    expect(lessons.filter((lesson) => lesson.state === 'done')).toHaveLength(0);
  });
});

describe('reviewed syllables (docs/20 §5 F2)', () => {
  it('rebuilds each word exactly from its syllables', () => {
    for (const word of REVIEWED_SYLLABLE_WORDS) {
      expect(syllablesOf(word)!.join(''), word).toBe(word);
    }
  });

  it('covers every multi-syllable word lesson and every Explorar word', () => {
    const monosyllables = new Set(UNITS.find((unit) => unit.id === 'palavras-monossilabas')!.pool);
    const wordTargets = UNITS.filter((unit) => unit.type === 'word').flatMap((unit) => unit.pool).filter((w) => !monosyllables.has(w));
    const explore = WORD_BANK.map((word) => word.label).filter((label) => !['FLOR', 'SOL'].includes(label));
    for (const word of [...wordTargets, ...explore]) expect(syllablesOf(word), word).not.toBeNull();
  });

  it('keeps the new theme words distinct from the words already taught', () => {
    const themed = UNITS.filter((unit) => unit.id.startsWith('palavras-') && unit.order >= 17).flatMap((unit) => unit.pool);
    const earlier = UNITS.filter((unit) => unit.order < 17).flatMap((unit) => unit.pool).map(normalize);
    expect(themed).toHaveLength(20);
    for (const word of themed) expect(earlier, word).not.toContain(normalize(word));
    expect(new Set(themed.map(normalize)).size).toBe(themed.length);
  });
});
