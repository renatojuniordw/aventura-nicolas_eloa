import { getLevelData } from '../content/level-registry.js';
import { loadLevel, deepFreeze } from '../content/level-loader.js';
import type { Box } from '../physics/aabb.js';
import type { WordEntry } from '../content/word-bank.js';
import {
  TEMPLATE_IDS,
  SEGMENT_WIDTH,
  CANDIDATE_SPOTS,
  isSafeFromHazards,
  isTapReachable,
  shuffle,
  type Spot,
} from './speedrun-course.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ITEM_SIZE = 32;
/**
 * Conservative per-segment item budget. Real usable-spot counts run 6-8 after
 * hazard/reachability filtering, so this leaves margin rather than chasing
 * the exact number — a short word fits in one stitched template segment, a
 * long one (e.g. "BORBOLETA", "PASSARINHO") spills into extra ones.
 */
const SPOTS_PER_GEOMETRY_SEGMENT_BUDGET = 5;

/**
 * Minimal shape read from a loaded template level, mirroring
 * `speedrun-course.ts`'s own local narrowing of `loadLevel`'s generic return.
 */
interface RawTemplateLevel {
  worldHeight: number;
  solids: Box[];
  oneWayPlatforms: Box[];
  hazards: (Box & { id: string })[];
}

export interface ExploreItem extends Box {
  id: string;
  /** Index of the word this item belongs to — the "segment" for gating purposes. */
  segmentIndex: number;
  kind: 'discovery' | 'letter';
  type: 'discovery' | 'target' | 'distractor';
  label: string;
  /** Left-to-right order within the word, for `target` letters only. */
  letterIndex?: number;
  fact?: string;
}

interface PlacedSegment {
  spots: Spot[]; // world-space, sorted left to right, tap-reachable & hazard-safe
}

interface BuildExploreCourseOptions {
  random?: () => number;
}

/**
 * Builds a continuous world for the "Explorar" mode: one segment per word in
 * `wordEntries` (stitched from the same 4 stage templates speedrun uses, and
 * spanning extra ones for longer words). Each segment holds a "discovery"
 * marker — the word plus its narrated fact — followed by the word's letters
 * in left-to-right order and a couple of distractor letters, so a round is
 * physically identical to Corrida do Alfabeto: run, jump, collect.
 *
 * @returns validated Level object for the physics engine and renderer
 */
export function buildExploreCourse(
  wordEntries: WordEntry[],
  { random = Math.random }: BuildExploreCourseOptions = {},
) {
  const templates = TEMPLATE_IDS.map((id) => {
    const raw = getLevelData(id);
    if (!raw) throw new Error(`Missing template level data: ${id}`);
    return loadLevel(raw) as unknown as RawTemplateLevel;
  });

  const worldHeight = templates[0].worldHeight;
  const solids: Box[] = [];
  const oneWayPlatforms: Box[] = [];
  const hazards: (Box & { id: string })[] = [];
  const items: ExploreItem[] = [];
  const checkpoints: Spot[] = [];

  let geometryCursor = 0;

  for (let wordIndex = 0; wordIndex < wordEntries.length; wordIndex += 1) {
    const word = wordEntries[wordIndex];
    const letters = Array.from(word.label);
    const desiredDistractors = 2;
    const wanted = 1 + letters.length + desiredDistractors;

    const placed: PlacedSegment[] = [];
    let pooledSpotCount = 0;
    // Stitch template segments (cycling the same 4 as speedrun) until there is
    // room for the word plus a couple of distractors, or a generous hard cap
    // is hit (guards against a pathological run of hazard-heavy templates).
    while (pooledSpotCount < wanted && placed.length < letters.length + 3) {
      const templateIndex = geometryCursor % templates.length;
      const template = templates[templateIndex];
      const xOffset = geometryCursor * SEGMENT_WIDTH;

      for (const solid of template.solids) {
        solids.push({ x: solid.x + xOffset, y: solid.y, w: solid.w, h: solid.h });
      }
      for (const platform of template.oneWayPlatforms) {
        oneWayPlatforms.push({ x: platform.x + xOffset, y: platform.y, w: platform.w, h: platform.h });
      }
      for (const hazard of template.hazards) {
        hazards.push({
          id: `hazard-w${wordIndex}-${geometryCursor}-${hazard.id}`,
          x: hazard.x + xOffset,
          y: hazard.y,
          w: hazard.w,
          h: hazard.h,
        });
      }

      const rawSpots = CANDIDATE_SPOTS[templateIndex];
      const safeSpots = rawSpots.filter((s) => isSafeFromHazards(s.x, ITEM_SIZE, template.hazards));
      const spotCandidates = safeSpots.length >= 4 ? safeSpots : rawSpots;
      const supports = [...template.solids, ...template.oneWayPlatforms];
      const reachableSpots = spotCandidates.filter((s) => isTapReachable(s, supports));
      const usableSpots = (reachableSpots.length > 0 ? reachableSpots : spotCandidates)
        .map((s) => ({ x: s.x + xOffset, y: s.y }))
        .sort((a, b) => a.x - b.x);

      if (placed.length === 0) checkpoints.push({ x: xOffset + 96, y: 406 });
      placed.push({ spots: usableSpots });
      pooledSpotCount += usableSpots.length;
      geometryCursor += 1;

      // Only budget-worth of segments strictly needed; loop condition above
      // re-checks pooledSpotCount, this just avoids an infinite spin if a
      // template ever produced zero usable spots.
      if (usableSpots.length === 0 && placed.length >= SPOTS_PER_GEOMETRY_SEGMENT_BUDGET) break;
    }

    // Segments are stitched left to right, and each segment's own spots are
    // already x-sorted, so concatenating keeps the whole word's spot pool
    // ordered left to right too.
    const orderedSpots = placed.flatMap((segment) => segment.spots);
    const chosen = orderedSpots.slice(0, Math.min(wanted, orderedSpots.length));
    const markerSpot = chosen[0];
    const remaining = chosen.slice(1);

    const distractorCount = Math.max(0, Math.min(desiredDistractors, remaining.length - letters.length));
    const letterSlotCount = Math.min(letters.length, remaining.length);

    // Randomly choose which remaining slots are distractors; the rest, taken
    // in their existing left-to-right order, carry the word's letters in
    // order — spellable in sequence while distractors are scattered among them.
    const distractorPositions = new Set(
      shuffle(
        Array.from({ length: remaining.length }, (_, i) => i),
        random,
      ).slice(0, distractorCount),
    );

    const neighbourLetters = new Set([
      ...letters,
      ...Array.from(wordEntries[wordIndex - 1]?.label ?? ''),
      ...Array.from(wordEntries[wordIndex + 1]?.label ?? ''),
    ]);
    const distractorPool = ALPHABET.filter((letter) => !neighbourLetters.has(letter));
    const distractorLetters = shuffle(distractorPool, random).slice(0, distractorCount);

    items.push({
      id: `explore-item-w${wordIndex}-marker`,
      segmentIndex: wordIndex,
      kind: 'discovery',
      type: 'discovery',
      label: word.label,
      fact: word.fact,
      x: markerSpot.x,
      y: markerSpot.y,
      w: ITEM_SIZE,
      h: ITEM_SIZE,
    });

    let letterCursor = 0;
    let distractorCursor = 0;
    for (let i = 0; i < remaining.length; i += 1) {
      const spot = remaining[i];
      if (distractorPositions.has(i) && distractorCursor < distractorCount) {
        items.push({
          id: `explore-item-w${wordIndex}-d${distractorCursor}`,
          segmentIndex: wordIndex,
          kind: 'letter',
          type: 'distractor',
          label: distractorLetters[distractorCursor] ?? 'X',
          x: spot.x,
          y: spot.y,
          w: ITEM_SIZE,
          h: ITEM_SIZE,
        });
        distractorCursor += 1;
      } else if (letterCursor < letterSlotCount) {
        items.push({
          id: `explore-item-w${wordIndex}-l${letterCursor}`,
          segmentIndex: wordIndex,
          kind: 'letter',
          type: 'target',
          label: letters[letterCursor],
          letterIndex: letterCursor,
          x: spot.x,
          y: spot.y,
          w: ITEM_SIZE,
          h: ITEM_SIZE,
        });
        letterCursor += 1;
      }
    }
  }

  const worldWidth = geometryCursor * SEGMENT_WIDTH;

  return deepFreeze({
    schemaVersion: 1,
    id: 'explore-quintal-das-descobertas',
    name: 'Quintal das Descobertas',
    tileset: 'placeholder',
    viewport: { width: 960, height: 540 },
    tileSize: 32,
    background: 'bg:primavera-lago',
    music: null,
    playerStart: { x: 96, y: 406 },
    checkpoint: { ...checkpoints[0] },
    camera: {
      startX: 0,
      maxX: Math.max(0, worldWidth - 960),
      smoothing: 0.12,
    },
    physics: {},
    solids,
    oneWayPlatforms,
    items,
    hazards,
    decorations: [],
    worldWidth,
    worldHeight,
    checkpoints,
    words: wordEntries,
  });
}
