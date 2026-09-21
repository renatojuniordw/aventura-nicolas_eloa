#!/usr/bin/env node
/**
 * Gera um arquivo de fase por lição do currículo.
 *
 * As fases são *dados*: cada lição recebe um terreno a partir de um template e
 * os itens (alvo + distratores) a partir do currículo. Nada aqui é importado em
 * tempo de execução — a saída é JSON versionado, validado pelo próprio
 * `loadLevel`, de modo que um erro de conteúdo falha na geração, não no jogo.
 *
 * Uso: npm run generate:levels
 */

import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandCurriculum, choicesForLesson, type Unit, type Lesson } from '../src/content/curriculum-model.js';
import { loadLevel } from '../src/content/level-loader.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CURRICULUM_PATH = join(ROOT, 'src', 'content', 'curriculum.json');
const OUTPUT_DIR = join(ROOT, 'src', 'content', 'levels');

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

const TEMPLATES = [planicie, degraus, plataformas, rio];

interface Template {
  name: string;
  solid: string[][];
  platform: string[][];
  slots: { x: number; y: number }[];
  hazards: unknown[];
}

// --- Level assembly ---------------------------------------------------------
function buildLevel(lesson: Lesson, unit: Unit, template: Template) {
  const choices = choicesForLesson(unit, lesson, MAX_CHOICES);
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

// --- Main -------------------------------------------------------------------
function main() {
  const curriculum = JSON.parse(readFileSync(CURRICULUM_PATH, 'utf8'));
  const { units } = expandCurriculum(curriculum);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Remove previously generated levels so removed lessons do not linger.
  for (const file of readdirSync(OUTPUT_DIR)) {
    if (file.startsWith('fase-') && file.endsWith('.json')) {
      unlinkSync(join(OUTPUT_DIR, file));
    }
  }

  const written = [];
  let levelIndex = 0;
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      const template = TEMPLATES[levelIndex % TEMPLATES.length]();
      levelIndex += 1;
      const level = buildLevel(lesson, unit, template);

      // Fail loudly on malformed content instead of shipping a broken level.
      loadLevel(level);
      writeFileSync(
        join(OUTPUT_DIR, `${lesson.levelId}.json`),
        `${JSON.stringify(level, null, 2)}\n`,
        'utf8',
      );
      written.push(lesson.levelId);
    }
  }

  process.stdout.write(
    `Geradas ${written.length} fases em src/content/levels/ (a partir de ${units.length} unidades).\n`,
  );
}

main();
