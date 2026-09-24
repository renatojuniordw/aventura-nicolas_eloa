import { describe, it, expect } from 'vitest';
import { createExploreStream, createLessonStream, createSpeedrunStream, ALPHABET } from './stream-courses.js';
import { WORD_BANK } from '../content/word-bank.js';
import { getLesson } from '../content/curriculum.js';
import { normalize } from '../content/text-utils.js';

describe('createExploreStream', () => {
  it('starts with the first letter and never uses a letter of the word as a distractor', () => {
    for (const word of WORD_BANK) {
      const stream = createExploreStream(word, { random: () => 0.3 });
      expect(stream.liveTarget?.label).toBe(Array.from(word.label)[0]);
      const wordLetters = new Set(Array.from(word.label).map(normalize));
      for (const item of stream.level.items.filter((i) => i.type === 'distractor')) {
        expect(wordLetters.has(normalize(item.label)), `${word.id}: ${item.label}`).toBe(false);
      }
    }
  });
});

describe('createSpeedrunStream', () => {
  it('starts at A and skips the target and its neighbours among distractors', () => {
    const stream = createSpeedrunStream({ random: () => 0.5 });
    expect(stream.liveTarget?.label).toBe('A');
    for (const item of stream.level.items.filter((i) => i.type === 'distractor')) {
      expect(['A', 'B']).not.toContain(item.label);
    }
    expect(ALPHABET).toHaveLength(26);
  });
});

describe('createLessonStream', () => {
  it('uses the lesson level file for target, kind and distractor labels', () => {
    const lesson = getLesson('alfabeto-a')!;
    const stream = createLessonStream(lesson, { random: () => 0.4 });

    expect(stream.level.id).toBe(lesson.levelId);
    expect(stream.liveTarget?.label).toBe(lesson.target);
    expect(stream.liveTarget?.kind).toBe('letter');
    const distractors = stream.level.items.filter((i) => i.type === 'distractor');
    expect(distractors.length).toBeGreaterThan(0);
    for (const item of distractors) expect(normalize(item.label)).not.toBe(normalize(lesson.target));
  });
});
