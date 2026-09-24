import { describe, it, expect } from 'vitest';
import { buildExploreCourse } from './explore-course.js';
import { isSafeFromHazards, isTapReachable, MIN_HAZARD_DISTANCE } from './speedrun-course.js';
import { WORD_BANK } from '../content/word-bank.js';

const SHORT_WORDS = WORD_BANK.filter((w) => w.id === 'sol' || w.id === 'lua' || w.id === 'gato');
const LONG_WORDS = WORD_BANK.filter((w) => w.id === 'borboleta' || w.id === 'passarinho');

describe('buildExploreCourse', () => {
  it('holds every letter of the word in order and no discovery marker', () => {
    for (const word of SHORT_WORDS) {
      const course = buildExploreCourse(word, { random: () => 0.42 });
      expect(course.items.every((item) => item.kind === 'letter')).toBe(true);

      const letters = course.items
        .filter((item) => item.type === 'target')
        .sort((a, b) => (a.letterIndex ?? 0) - (b.letterIndex ?? 0));
      expect(letters.map((l) => l.label).join('')).toBe(word.label);
    }
  });

  it('is frozen, just like any regular level', () => {
    const course = buildExploreCourse(SHORT_WORDS[0]);
    expect(Object.isFrozen(course)).toBe(true);
    expect(Object.isFrozen(course.items)).toBe(true);
    expect(Object.isFrozen(course.items[0])).toBe(true);
  });

  it('lays out every long word (spanning multiple stitched segments) fully and in order', () => {
    for (const word of LONG_WORDS) {
      const course = buildExploreCourse(word, { random: () => 0.3 });
      const letters = course.items
        .filter((item) => item.type === 'target')
        .sort((a, b) => (a.letterIndex ?? 0) - (b.letterIndex ?? 0));
      expect(letters.map((l) => l.label).join('')).toBe(word.label);
      // Letters must read left to right physically, matching their order in the word.
      const xs = letters.map((l) => l.x);
      for (let i = 1; i < xs.length; i += 1) {
        expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      }
    }
  });

  it('places every item where a quick jump tap can reach it, for several random seeds', () => {
    for (const word of WORD_BANK) {
      for (const seed of [0.1, 0.6]) {
        const course = buildExploreCourse(word, { random: () => seed });
        const supports = [...course.solids, ...course.oneWayPlatforms];
        for (const item of course.items) {
          expect(isTapReachable(item, supports)).toBe(true);
        }
      }
    }
  });

  it('never places any item directly over or dangerously close to any hazard', () => {
    for (const word of WORD_BANK) {
      for (const seed of [0.05, 0.95]) {
        const course = buildExploreCourse(word, { random: () => seed });
        for (const item of course.items) {
          expect(isSafeFromHazards(item.x, item.w, course.hazards, MIN_HAZARD_DISTANCE)).toBe(true);
        }
      }
    }
  });

  it('never uses a letter from the word itself as a distractor', () => {
    const [word] = SHORT_WORDS;
    const course = buildExploreCourse(word, { random: () => 0.2 });
    const distractors = course.items.filter((i) => i.type === 'distractor');
    expect(distractors.length).toBeGreaterThan(0);
    for (const item of distractors) {
      expect(word.label.includes(item.label)).toBe(false);
    }
  });

  it('keeps the player spawn clear of the first item', () => {
    for (const word of WORD_BANK) {
      const course = buildExploreCourse(word, { random: () => 0.5 });
      for (const item of course.items) {
        expect(item.x).toBeGreaterThan(course.playerStart.x + 64);
      }
    }
  });
});
