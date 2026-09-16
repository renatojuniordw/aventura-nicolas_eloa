import { getLevelData } from '../content/level-registry.js';
import { loadLevel } from '../content/level-loader.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SEGMENT_WIDTH = 1920; // 60 tiles * 32px

const TEMPLATE_IDS = [
  'fase-alfabeto-a', // 0: Planície
  'fase-alfabeto-b', // 1: Degraus
  'fase-alfabeto-c', // 2: Plataformas
  'fase-alfabeto-d', // 3: Rio
];

/**
 * Candidate item spots for each template (relative to segment start X).
 * Heights (y) vary from ground level (~384) to platforms (~288, ~320) and high jumps (~192, ~224, ~256).
 */
const CANDIDATE_SPOTS = [
  // 0: Planície (ground items at y: 310..320; platform items at y: 220..250)
  [
    { x: 340, y: 320 },
    { x: 580, y: 310 },
    { x: 880, y: 250 },
    { x: 960, y: 220 },
    { x: 1040, y: 250 },
    { x: 1320, y: 320 },
    { x: 1620, y: 310 },
  ],
  // 1: Degraus (all items positioned above walking height)
  [
    { x: 320, y: 320 },
    { x: 680, y: 260 },
    { x: 880, y: 250 },
    { x: 1280, y: 200 },
    { x: 1440, y: 190 },
    { x: 1580, y: 240 },
    { x: 1740, y: 320 },
  ],
  // 2: Plataformas (floating platforms and elevated ground jumps)
  [
    { x: 260, y: 320 },
    { x: 480, y: 230 },
    { x: 740, y: 320 },
    { x: 960, y: 220 },
    { x: 1180, y: 310 },
    { x: 1440, y: 230 },
    { x: 1700, y: 320 },
  ],
  // 3: Rio (elevated jumps, including over the water gap)
  [
    { x: 320, y: 320 },
    { x: 600, y: 310 },
    { x: 896, y: 260 },
    { x: 1120, y: 320 },
    { x: 1400, y: 310 },
    { x: 1680, y: 320 },
  ],
];

function shuffle(array, random) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Builds a continuous 26-segment course for the Alphabet Speed Run.
 *
 * Each segment represents one letter (A to Z) with terrain seamlessly stitched
 * from the 4 stage templates. Items are placed at randomized candidate spots
 * in every segment so no two runs feel identical.
 *
 * @param {{ random?: () => number }} [options]
 * @returns {object} validated Level object for the physics engine and renderer
 */
export function buildSpeedrunCourse({ random = Math.random } = {}) {
  // Pre-load the 4 base templates
  const templates = TEMPLATE_IDS.map((id) => {
    const raw = getLevelData(id);
    if (!raw) throw new Error(`Missing template level data: ${id}`);
    return loadLevel(raw);
  });

  const totalSegments = ALPHABET.length;
  const worldWidth = totalSegments * SEGMENT_WIDTH;
  const worldHeight = templates[0].worldHeight;

  const solids = [];
  const oneWayPlatforms = [];
  const hazards = [];
  const items = [];
  const checkpoints = [];

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

    // Randomize item positions within this segment
    const spotCandidates = CANDIDATE_SPOTS[templateIndex];
    const shuffledSpots = shuffle(spotCandidates, random);

    // Pick 3 distractors from alphabet excluding current target letter
    const distractorCandidates = ALPHABET.filter((l) => l !== letter);
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
      const spot = shuffledSpots[k % shuffledSpots.length];
      const jitterX = Math.floor((random() - 0.5) * 20);
      const x = Math.round(spot.x + xOffset + jitterX);
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

  return {
    schemaVersion: 1,
    id: 'speedrun-maratona-alfabeto',
    name: 'Maratona do Alfabeto',
    tileset: 'placeholder',
    viewport: { width: 960, height: 540 },
    tileSize: 32,
    background: '#9bd3f5',
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
  };
}
