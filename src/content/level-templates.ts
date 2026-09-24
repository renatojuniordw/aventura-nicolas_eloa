import { choicesForLesson, type Unit, type Lesson } from './curriculum-model.js';

// --- Geometry ---------------------------------------------------------------
const TILE = 32;
const COLS = 60;
const ROWS = 17;
const GROUND_ROW = 14;
const GROUND_Y = GROUND_ROW * TILE; // 448
const ITEM_Y = GROUND_Y - 96; // 352 — reachable at the jump apex
const PLATFORM_ITEM_LIFT = 96; // items above a platform need a small hop
const MAX_CHOICES = 4;

// --- Grid helpers -----------------------------------------------------------
function emptyRows() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
}

function fill(
  rows: string[][],
  rowFrom: number,
  rowTo: number,
  colFrom: number,
  colTo: number,
  char: string,
): void {
  for (let row = rowFrom; row <= rowTo; row += 1) {
    for (let column = colFrom; column <= colTo; column += 1) {
      rows[row][column] = char;
    }
  }
}

// --- Terrain templates ------------------------------------------------------
function planicie() {
  const solid = emptyRows();
  fill(solid, GROUND_ROW, ROWS - 1, 0, COLS - 1, '#');
  const platform = emptyRows();
  fill(platform, 12, 12, 26, 33, '=');
  return {
    name: 'Planície',
    solid,
    platform,
    slots: [
      { x: 12 * TILE, y: ITEM_Y },
      { x: 29 * TILE, y: 12 * TILE - PLATFORM_ITEM_LIFT },
      { x: 40 * TILE, y: ITEM_Y },
      { x: 53 * TILE, y: ITEM_Y },
    ],
    hazards: [],
  };
}

function degraus() {
  const solid = emptyRows();
  fill(solid, GROUND_ROW, ROWS - 1, 0, COLS - 1, '#');
  fill(solid, 12, ROWS - 1, 18, 33, '#');
  fill(solid, 10, ROWS - 1, 38, 53, '#');
  return {
    name: 'Degraus',
    solid,
    platform: emptyRows(),
    slots: [
      { x: 8 * TILE, y: ITEM_Y },
      { x: 24 * TILE, y: 12 * TILE - PLATFORM_ITEM_LIFT },
      { x: 44 * TILE, y: 10 * TILE - PLATFORM_ITEM_LIFT },
      { x: 56 * TILE, y: ITEM_Y },
    ],
    hazards: [],
  };
}

function plataformas() {
  const solid = emptyRows();
  fill(solid, GROUND_ROW, ROWS - 1, 0, COLS - 1, '#');
  const platform = emptyRows();
  fill(platform, 11, 11, 12, 17, '=');
  fill(platform, 11, 11, 27, 32, '=');
  fill(platform, 11, 11, 42, 47, '=');
  return {
    name: 'Plataformas',
    solid,
    platform,
    slots: [
      { x: 3 * TILE, y: ITEM_Y },
      { x: 14 * TILE, y: 11 * TILE - PLATFORM_ITEM_LIFT },
      { x: 29 * TILE, y: 11 * TILE - PLATFORM_ITEM_LIFT },
      { x: 44 * TILE, y: 11 * TILE - PLATFORM_ITEM_LIFT },
    ],
    hazards: [],
  };
}

function rio() {
  const solid = emptyRows();
  const gapFrom = 26;
  const gapTo = 29;
  fill(solid, GROUND_ROW, ROWS - 1, 0, gapFrom - 1, '#');
  fill(solid, GROUND_ROW, ROWS - 1, gapTo + 1, COLS - 1, '#');
  return {
    name: 'Rio',
    solid,
    platform: emptyRows(),
    slots: [
      { x: 8 * TILE, y: ITEM_Y },
      { x: 20 * TILE, y: ITEM_Y },
      { x: 36 * TILE, y: ITEM_Y },
      { x: 50 * TILE, y: ITEM_Y },
    ],
    hazards: [],
  };
}

export const TEMPLATES = [planicie, degraus, plataformas, rio];

interface Template {
  name: string;
  solid: string[][];
  platform: string[][];
  slots: { x: number; y: number }[];
  hazards: unknown[];
}

// --- Level assembly ---------------------------------------------------------
export function buildLessonLevel(lesson: Lesson, unit: Unit, template: Template, count = MAX_CHOICES) {
  const choices = choicesForLesson(unit, lesson, count);
  const items = choices.map((label, index) => ({
    id: label === lesson.target ? 'item-alvo' : `item-opcao-${index}`,
    type: label === lesson.target ? 'target' : 'distractor',
    kind: lesson.type,
    label,
    x: template.slots[index].x,
    y: template.slots[index].y,
    w: TILE,
    h: TILE,
  }));

  const startY = GROUND_Y - 42; // player height
  return {
    schemaVersion: 1,
    id: lesson.levelId,
    name: `${template.name} — ${lesson.target}`,
    tileset: 'placeholder',
    viewport: { width: 960, height: 540 },
    tileSize: TILE,
    background: '#9bd3f5',
    music: null,
    playerStart: { x: 96, y: startY },
    checkpoint: { x: 96, y: startY },
    camera: { startX: 0, maxX: COLS * TILE - 960, smoothing: 0.12 },
    map: {
      solid: template.solid.map((row) => row.join('')),
      platform: template.platform.map((row) => row.join('')),
    },
    items,
    hazards: template.hazards,
    decorations: [],
  };
}

