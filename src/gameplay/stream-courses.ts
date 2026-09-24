import { getLevelData } from '../content/level-registry.js';
import { normalize } from '../content/text-utils.js';
import type { Lesson } from '../content/curriculum-model.js';
import type { WordEntry } from '../content/word-bank.js';
import { WorldStream } from './world-stream.js';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface StreamCourseOptions {
  random?: () => number;
}

/**
 * "Explorar": the word's letters are the targets (one live at a time, in
 * order); the distractors are alphabet letters that are not in the word.
 */
export function createExploreStream(word: WordEntry, { random }: StreamCourseOptions = {}): WorldStream {
  const wordLetters = new Set(Array.from(word.label).map(normalize));
  const pool = ALPHABET.filter((letter) => !wordLetters.has(normalize(letter)));
  return new WorldStream({
    id: `explore-${word.id}`,
    name: 'Quintal das Descobertas',
    target: Array.from(word.label)[0],
    kind: 'letter',
    distractorPool: () => pool,
    random,
  });
}

/**
 * Alphabet marathon: A to Z. Distractors skip the current letter and its
 * neighbours, so a look-alike never sits beside the real one.
 */
export function createSpeedrunStream({ random }: StreamCourseOptions = {}): WorldStream {
  return new WorldStream({
    id: 'speedrun-maratona-alfabeto',
    name: 'Maratona do Alfabeto',
    target: ALPHABET[0],
    kind: 'letter',
    distractorPool: (target) => {
      const i = ALPHABET.indexOf(target);
      const skip = new Set([target, ALPHABET[i - 1], ALPHABET[i + 1]]);
      return ALPHABET.filter((letter) => !skip.has(letter));
    },
    random,
  });
}

interface RawLessonItem {
  type?: string;
  kind?: string;
  label?: string;
}

/**
 * A curriculum lesson: the target and distractor labels come from the lesson's
 * level file (letters, syllables or words), scattered over the endless world.
 */
export function createLessonStream(lesson: Lesson, { random }: StreamCourseOptions = {}): WorldStream {
  const items = ((getLevelData(lesson.levelId)?.items as RawLessonItem[] | undefined) ?? []).filter(
    (item) => item.label,
  );
  const accepted = new Set([lesson.target, ...lesson.variants].map(normalize));
  const targetItem = items.find((item) => item.type === 'target');
  const pool = items
    .filter((item) => item.type === 'distractor' && !accepted.has(normalize(item.label)))
    .map((item) => item.label as string);
  return new WorldStream({
    id: lesson.levelId,
    name: lesson.unitTitle,
    target: lesson.target,
    kind: targetItem?.kind ?? (lesson.type === 'word' ? 'word' : lesson.type === 'syllable' ? 'syllable' : 'letter'),
    distractorPool: () => pool,
    random,
  });
}
