import { GAMEPLAY } from '../core/config.js';

/**
 * Shared building blocks for the endless world (`world-stream.ts`): the stage
 * templates, where letters may sit in them, and the reachability/safety rules.
 */
export const SEGMENT_WIDTH = 1920; // 60 tiles * 32px

export const TEMPLATE_IDS = [
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

export interface Spot {
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
export const CANDIDATE_SPOTS: Spot[][] = [
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

export function shuffle<T>(array: T[], random: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}
