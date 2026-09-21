import { getLevelData } from '../content/level-registry.js';
import { loadLevel, deepFreeze } from '../content/level-loader.js';
import type { Box } from '../physics/aabb.js';
import { GAMEPLAY } from '../core/config.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SEGMENT_WIDTH = 1920; // 60 tiles * 32px
/** The target is preferably placed within this segment-local x (first ~60%). */
const EARLY_TARGET_MAX_X = 1150;

const TEMPLATE_IDS = [
  'fase-alfabeto-a', // 0: Planície
  'fase-alfabeto-b', // 1: Degraus
  'fase-alfabeto-c', // 2: Plataformas
  'fase-alfabeto-d', // 3: Rio
];

/**
 * Minimum horizontal clearance (in pixels) required between any item and any hazard.
 * Prevents letters from appearing directly above or dangerously close to hazards (e.g. spikes).
 */
export const MIN_HAZARD_DISTANCE = 160;

interface HazardLike {
  x: number;
  w: number;
}

/**
 * Checks whether an item at (x, w) has safe clearance from all hazards.
 *
 * @param x item horizontal position
 * @param w item width
 */
export function isSafeFromHazards(
  x: number,
  w: number,
  hazards: HazardLike[] | undefined,
  minDistance = MIN_HAZARD_DISTANCE,
): boolean {
  if (!hazards || hazards.length === 0) return true;
  const itemLeft = x;
  const itemRight = x + w;

  for (const h of hazards) {
    const hazardLeft = h.x;
    const hazardRight = h.x + h.w;
    // Overlaps or is closer than minDistance horizontally
    if (itemRight + minDistance > hazardLeft && itemLeft - minDistance < hazardRight) {
      return false;
    }
  }
  return true;
}

interface Spot {
  x: number;
  y: number;
}

interface SupportBox {
  x: number;
  y: number;
  w: number;
}

const ITEM_SIZE = 32;
const PLAYER_HEIGHT = 42;
/** Rise of the shortest possible jump (a quick tap): (v * cut)^2 / 2g ~= 26px. */
const TAP_JUMP_RISE = 26;

/**
 * True when a quick tap of the jump button is enough to touch an item at `spot`:
 * a player standing on the surface below it must reach the item's (pickup-margin
 * inflated) bottom edge, yet never touch it just by walking.
 */
export function isTapReachable(spot: Spot, supports: SupportBox[]): boolean {
  let top = Infinity;
  for (const box of supports) {
    const below = box.y >= spot.y + ITEM_SIZE;
    const under = spot.x < box.x + box.w && spot.x + ITEM_SIZE > box.x;
    if (below && under && box.y < top) top = box.y;
  }
  if (top === Infinity) return false;
  const standingTop = top - PLAYER_HEIGHT;
  const reachBottom = spot.y + ITEM_SIZE + GAMEPLAY.itemPickupMargin;
  return standingTop - TAP_JUMP_RISE < reachBottom && reachBottom < standingTop;
}

/**
 * Candidate item spots for each template (relative to segment start X).
 * Heights (y) vary from ground jumps (~310..320) to elevated platforms (~200..250).
 * All spots are positioned away from hazards (such as spikes) and pit gaps.
 */
const CANDIDATE_SPOTS: Spot[][] = [
  // 0: Planície (ground jumps at y: 340; platform jumps at y: 220..250)
  [
    { x: 340, y: 340 },
    { x: 580, y: 340 },
    { x: 880, y: 250 },
    { x: 960, y: 220 },
    { x: 1040, y: 250 },
    { x: 1320, y: 340 },
    { x: 1620, y: 340 },
  ],
  // 1: Degraus (all items positioned above walking height)
  [
    { x: 320, y: 340 },
    { x: 680, y: 260 },
    { x: 880, y: 250 },
    { x: 1280, y: 200 },
    { x: 1440, y: 190 },
    { x: 1580, y: 240 },
    { x: 1740, y: 340 },
  ],
  // 2: Plataformas (floating platforms and safe ground jumps, safely away from spikes at x:1152..1216)
  [
    { x: 260, y: 340 },
    { x: 420, y: 240 },
    { x: 500, y: 230 },
    { x: 740, y: 340 },
    { x: 940, y: 220 },
    { x: 1420, y: 230 },
    { x: 1520, y: 220 },
    { x: 1700, y: 340 },
  ],
  // 3: Rio (elevated jumps over solid ground, safely away from river gap at x:832..960)
  [
    { x: 320, y: 340 },
    { x: 600, y: 340 },
    { x: 740, y: 340 },
    { x: 1040, y: 340 },
    { x: 1160, y: 340 },
    { x: 1400, y: 340 },
    { x: 1680, y: 340 },
  ],
];

function shuffle<T>(array: T[], random: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

interface BuildSpeedrunCourseOptions {
  random?: () => number;
}

/**
 * Minimal shape read from a loaded template level. `loadLevel`'s JSDoc return
 * type is still the generic `Readonly<object>` (level-loader.js hasn't been
 * converted to TS yet) — narrow it locally until that conversion happens.
 */
interface RawTemplateLevel {
  worldHeight: number;
  solids: Box[];
  oneWayPlatforms: Box[];
  hazards: (Box & { id: string })[];
}

/**
 * Builds a continuous 26-segment course for the Alphabet Speed Run.
 *
 * Each segment represents one letter (A to Z) with terrain seamlessly stitched
 * from the 4 stage templates. Items are placed at randomized candidate spots
 * in every segment so no two runs feel identical.
 *
 * @returns validated Level object for the physics engine and renderer
 */
export function buildSpeedrunCourse({ random = Math.random }: BuildSpeedrunCourseOptions = {}) {
  // Pre-load the 4 base templates
  const templates = TEMPLATE_IDS.map((id) => {
    const raw = getLevelData(id);
    if (!raw) throw new Error(`Missing template level data: ${id}`);
    return loadLevel(raw) as unknown as RawTemplateLevel;
  });

  const totalSegments = ALPHABET.length;
  const worldWidth = totalSegments * SEGMENT_WIDTH;
  const worldHeight = templates[0].worldHeight;

  const solids: Box[] = [];
  const oneWayPlatforms: Box[] = [];
  const hazards: (Box & { id: string })[] = [];
  const items: (Box & {
    id: string;
    segmentIndex: number;
    type: string;
    kind: string;
    label: string;
  })[] = [];
  const checkpoints: Spot[] = [];

  for (let i = 0; i < totalSegments; i += 1) {
    const letter = ALPHABET[i];
    const templateIndex = i % templates.length;
    const template = templates[templateIndex];
    const xOffset = i * SEGMENT_WIDTH;

    // Checkpoint at start of segment
    checkpoints.push({ x: xOffset + 96, y: 406 });

    // Offset solids
    for (const solid of template.solids) {
      solids.push({
        x: solid.x + xOffset,
        y: solid.y,
        w: solid.w,
        h: solid.h,
      });
    }

    // Offset platforms
    for (const platform of template.oneWayPlatforms) {
      oneWayPlatforms.push({
        x: platform.x + xOffset,
        y: platform.y,
        w: platform.w,
        h: platform.h,
      });
    }

    // Offset hazards
    for (const hazard of template.hazards) {
      hazards.push({
        id: `hazard-${i}-${hazard.id}`,
        x: hazard.x + xOffset,
        y: hazard.y,
        w: hazard.w,
        h: hazard.h,
      });
    }

    // Randomize item positions within this segment (strictly filtering out any spot near hazards)
    const rawSpots = CANDIDATE_SPOTS[templateIndex];
    const safeSpots = rawSpots.filter((s) => isSafeFromHazards(s.x, 32, template.hazards));
    const spotCandidates = safeSpots.length >= 4 ? safeSpots : rawSpots;
    const shuffledSpots = shuffle(spotCandidates, random);

    // The target must be grabbable with a quick tap (kids tap, they don't hold) and
    // sit in the first part of the segment so the next letter never takes minutes.
    const supports: SupportBox[] = [...template.solids, ...template.oneWayPlatforms];
    const reachable = shuffledSpots.filter((s) => isTapReachable(s, supports));
    const targetSpot =
      reachable.find((s) => s.x <= EARLY_TARGET_MAX_X) ?? reachable[0] ?? shuffledSpots[0];
    const orderedSpots = [targetSpot, ...shuffledSpots.filter((s) => s !== targetSpot)];

    // Pick 3 distractors excluding this letter and its neighbours, so a look-alike
    // of the current target never sits next to the real one (or the next segment's).
    const neighbours = new Set([letter, ALPHABET[i - 1], ALPHABET[i + 1]]);
    const distractorCandidates = ALPHABET.filter((l) => !neighbours.has(l));
    const chosenDistractors = shuffle(distractorCandidates, random).slice(0, 3);

    // 1 Target + 3 Distractors
    const itemConfigs = [
      { type: 'target', label: letter },
      { type: 'distractor', label: chosenDistractors[0] },
      { type: 'distractor', label: chosenDistractors[1] },
      { type: 'distractor', label: chosenDistractors[2] },
    ];

    // Distribute among the shuffled spots
    for (let k = 0; k < itemConfigs.length; k += 1) {
      const spot = orderedSpots[k % orderedSpots.length];
      const jitterX = Math.floor((random() - 0.5) * 20);
      let localX = spot.x + jitterX;
      // If jitter moved the item too close to a hazard, discard jitter
      if (!isSafeFromHazards(localX, 32, template.hazards)) {
        localX = spot.x;
      }
      const x = Math.round(localX + xOffset);
      const y = Math.round(spot.y);

      items.push({
        id: `sr-item-${i}-${k}-${itemConfigs[k].type}`,
        segmentIndex: i,
        type: itemConfigs[k].type,
        kind: 'letter',
        label: itemConfigs[k].label,
        x,
        y,
        w: 32,
        h: 32,
      });
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    id: 'speedrun-maratona-alfabeto',
    name: 'Maratona do Alfabeto',
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
    alphabet: ALPHABET,
  });
}
