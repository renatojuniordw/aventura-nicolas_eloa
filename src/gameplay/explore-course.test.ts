import { describe, it, expect } from 'vitest';
import { buildExploreCourse } from './explore-course.js';
import { isSafeFromHazards, isTapReachable, MIN_HAZARD_DISTANCE } from './speedrun-course.js';
import { WORD_BANK } from '../content/word-bank.js';

const SHORT_WORDS = WORD_BANK.filter((w) => w.id === 'sol' || w.id === 'lua' || w.id === 'gato');
const LONG_WORDS = WORD_BANK.filter((w) => w.id === 'borboleta' || w.id === 'passarinho');

describe('buildExploreCourse', () => {
  it('builds one segment per word, each with a discovery marker and every letter', () => {
    const course = buildExploreCourse(SHORT_WORDS, { random: () => 0.42 });
    expect(course.checkpoints).toHaveLength(SHORT_WORDS.length);

    for (let i = 0; i < SHORT_WORDS.length; i += 1) {
      const word = SHORT_WORDS[i];
      const marker = course.items.find((item) => item.segmentIndex === i && item.kind === 'discovery');
      expect(marker?.label).toBe(word.label);
      expect(marker?.fact).toBe(word.fact);

      const letters = course.items
        .filter((item) => item.segmentIndex === i && item.type === 'target')
        .sort((a, b) => (a.letterIndex ?? 0) - (b.letterIndex ?? 0));
      expect(letters.map((l) => l.label).join('')).toBe(word.label);
    }
  });

  it('is frozen, just like any regular level', () => {
    const course = buildExploreCourse(SHORT_WORDS);
    expect(Object.isFrozen(course)).toBe(true);
    expect(Object.isFrozen(course.items)).toBe(true);
    expect(Object.isFrozen(course.items[0])).toBe(true);
  });

  it('lays out every long word (spanning multiple stitched segments) fully and in order', () => {
    for (const word of LONG_WORDS) {
      const course = buildExploreCourse([word], { random: () => 0.3 });
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
    const words = WORD_BANK.slice(0, 6);
    for (const seed of [0.1, 0.35, 0.6, 0.85]) {
      const course = buildExploreCourse(words, { random: () => seed });
      const supports = [...course.solids, ...course.oneWayPlatforms];
      for (const item of course.items) {
        expect(isTapReachable(item, supports)).toBe(true);
      }
    }
  });

  it('never places any item directly over or dangerously close to any hazard', () => {
    const words = WORD_BANK.slice(0, 6);
    for (const seed of [0.05, 0.5, 0.95]) {
      const course = buildExploreCourse(words, { random: () => seed });
      for (const item of course.items) {
        expect(isSafeFromHazards(item.x, item.w, course.hazards, MIN_HAZARD_DISTANCE)).toBe(true);
      }
    }
  });

  it('never uses a letter from the word itself or a neighbouring word as a distractor', () => {
    const words = WORD_BANK.slice(0, 6);
    const course = buildExploreCourse(words, { random: () => 0.2 });
    for (const item of course.items.filter((i) => i.type === 'distractor')) {
      const word = words[item.segmentIndex];
      const prev = words[item.segmentIndex - 1];
      const next = words[item.segmentIndex + 1];
      const forbidden = new Set([
        ...Array.from(word.label),
        ...Array.from(prev?.label ?? ''),
        ...Array.from(next?.label ?? ''),
      ]);
      expect(forbidden.has(item.label)).toBe(false);
    }
  });
});
