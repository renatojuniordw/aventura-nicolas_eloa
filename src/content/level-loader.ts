import { VIEWPORT } from '../core/config.js';

/**
 * Turns a raw level file (JSON) into a validated, immutable Level object.
 *
 * Content is data: levels are authored in JSON and never require a code change.
 * The loader fills defaults, builds collision geometry from the character grid
 * and rejects malformed content early with a readable error — so a typo in a
 * level file fails a test instead of glitching the game.
 */

export class LevelValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LevelValidationError';
  }
}

const DEFAULT_TILE_SIZE = 32;
const SOLID_CHAR = '#';
const PLATFORM_CHAR = '=';

/**
 * @param {object} raw level data as authored in JSON
 * @param {{ viewport?: {width:number,height:number} }} [options]
 * @returns {Readonly<object>} normalized level
 */
export function loadLevel(raw, options = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new LevelValidationError('Level data must be an object');
  }
  if (!raw.id) throw new LevelValidationError('Level requires an "id"');
  if (!raw.name) throw new LevelValidationError(`Level "${raw.id}" requires a "name"`);

  const tileSize = raw.tileSize ?? DEFAULT_TILE_SIZE;
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    throw new LevelValidationError(`Level "${raw.id}" has an invalid tileSize`);
  }

  const viewport = raw.viewport ?? options.viewport ?? VIEWPORT;
  const solidRows = raw.map?.solid ?? [];
  const platformRows = raw.map?.platform ?? [];

  if (solidRows.length === 0) {
    throw new LevelValidationError(`Level "${raw.id}" requires map.solid rows`);
  }

  assertUniformRows(solidRows, raw.id, 'map.solid');
  assertUniformRows(platformRows, raw.id, 'map.platform');

  const columns = solidRows[0].length;
  if (platformRows.length > 0 && platformRows[0].length !== columns) {
    throw new LevelValidationError(
      `Level "${raw.id}": map.platform must have the same width as map.solid`,
    );
  }

  const worldWidth = columns * tileSize;
  const rows = Math.max(solidRows.length, platformRows.length);
  const worldHeight = rows * tileSize;

  const solids = [...gridToRectangles(solidRows, tileSize, SOLID_CHAR)];
  const oneWayPlatforms = gridToRectangles(platformRows, tileSize, PLATFORM_CHAR);

  const items = (raw.items ?? []).map((item) => normalizeRect(item, raw.id, 'item'));
  const hazards = (raw.hazards ?? []).map((hazard) => normalizeRect(hazard, raw.id, 'hazard'));
  const decorations = (raw.decorations ?? []).map((decoration) => ({ ...decoration }));

  assertUniqueIds(items, raw.id, 'item');
  assertUniqueIds(hazards, raw.id, 'hazard');
  assertInsideWorld([...items, ...hazards], worldWidth, worldHeight, raw.id);

  const playerStart = normalizePoint(raw.playerStart, raw.id, 'playerStart', worldWidth);
  const checkpoint = raw.checkpoint
    ? normalizePoint(raw.checkpoint, raw.id, 'checkpoint', worldWidth)
    : { ...playerStart };

  const targets = items.filter((item) => item.type === 'target');
  if (targets.length === 0) {
    throw new LevelValidationError(`Level "${raw.id}" needs at least one item of type "target"`);
  }

  return deepFreeze({
    schemaVersion: raw.schemaVersion ?? 1,
    id: raw.id,
    name: raw.name,
    tileset: raw.tileset ?? 'placeholder',
    viewport: { ...viewport },
    tileSize,
    background: raw.background ?? '#9bd3f5',
    music: raw.music ?? null,
    playerStart,
    checkpoint,
    camera: {
      startX: raw.camera?.startX ?? 0,
      maxX: raw.camera?.maxX ?? Math.max(0, worldWidth - viewport.width),
      smoothing: raw.camera?.smoothing ?? 0.12,
    },
    physics: { ...(raw.physics ?? {}) },
    solids,
    oneWayPlatforms,
    items,
    hazards,
    decorations,
    worldWidth,
    worldHeight,
  });
}

/**
 * Merge one or more collision-row strings into as few rectangles as possible
 * by merging horizontal runs per row. Fewer, wider rectangles mean fewer
 * collision checks and no phantom internal edges.
 */
export function gridToRectangles(rows, tileSize, solidChar) {
  const rectangles = [];
  rows.forEach((row, rowIndex) => {
    let runStart = -1;
    for (let column = 0; column <= row.length; column += 1) {
      const isSolid = column < row.length && row[column] === solidChar;
      if (isSolid && runStart === -1) {
        runStart = column;
      } else if (!isSolid && runStart !== -1) {
        rectangles.push({
          x: runStart * tileSize,
          y: rowIndex * tileSize,
          w: (column - runStart) * tileSize,
          h: tileSize,
        });
        runStart = -1;
      }
    }
  });
  return rectangles;
}

function assertUniformRows(rows, levelId, field) {
  if (rows.length === 0) return;
  const width = rows[0].length;
  rows.forEach((row, index) => {
    if (typeof row !== 'string') {
      throw new LevelValidationError(`Level "${levelId}": ${field}[${index}] must be a string`);
    }
    if (row.length !== width) {
      throw new LevelValidationError(
        `Level "${levelId}": ${field}[${index}] has width ${row.length}, expected ${width}`,
      );
    }
  });
}

function normalizeRect(source, levelId, kind) {
  const rect = {
    x: source.x,
    y: source.y,
    w: source.w ?? 32,
    h: source.h ?? 32,
    ...source,
  };
  for (const axis of ['x', 'y', 'w', 'h']) {
    if (!Number.isFinite(rect[axis])) {
      throw new LevelValidationError(
        `Level "${levelId}": ${kind} "${source.id ?? '?'}" has an invalid "${axis}"`,
      );
    }
  }
  if (!rect.id) {
    throw new LevelValidationError(`Level "${levelId}": every ${kind} requires an "id"`);
  }
  return rect;
}

function normalizePoint(point, levelId, field, worldWidth) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new LevelValidationError(`Level "${levelId}": ${field} requires numeric x and y`);
  }
  if (point.x < 0 || point.x > worldWidth) {
    throw new LevelValidationError(`Level "${levelId}": ${field}.x is outside the world`);
  }
  return { x: point.x, y: point.y };
}

function assertUniqueIds(entries, levelId, kind) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new LevelValidationError(`Level "${levelId}": duplicated ${kind} id "${entry.id}"`);
    }
    seen.add(entry.id);
  }
}

function assertInsideWorld(entries, worldWidth, worldHeight, levelId) {
  for (const entry of entries) {
    if (
      entry.x < 0 ||
      entry.y < 0 ||
      entry.x + entry.w > worldWidth ||
      entry.y + entry.h > worldHeight
    ) {
      throw new LevelValidationError(
        `Level "${levelId}": "${entry.id}" is outside the world bounds`,
      );
    }
  }
}

export function deepFreeze(object) {
  for (const value of Object.values(object)) {
    if (value && typeof value === 'object') {
      Object.freeze(value);
      if (Array.isArray(value)) {
        value.forEach((entry) => entry && typeof entry === 'object' && Object.freeze(entry));
      }
    }
  }
  return Object.freeze(object);
}
