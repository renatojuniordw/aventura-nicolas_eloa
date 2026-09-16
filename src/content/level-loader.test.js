import { describe, it, expect } from 'vitest';
import { loadLevel, gridToRectangles, LevelValidationError } from './level-loader.js';

const RAW = {
  schemaVersion: 1,
  id: 'test-level',
  name: 'Fase de Teste',
  tileSize: 16,
  playerStart: { x: 0, y: 0 },
  map: {
    solid: ['..##', '####'],
    platform: ['....', '..=='],
  },
  items: [{ id: 'target-a', type: 'target', kind: 'letter', label: 'A', x: 32, y: 0, w: 16, h: 16 }],
};

describe('gridToRectangles', () => {
  it('merges horizontal runs into one rectangle', () => {
    const rects = gridToRectangles(['..##'], 10, '#');
    expect(rects).toEqual([{ x: 20, y: 0, w: 20, h: 10 }]);
  });

  it('keeps separated runs as distinct rectangles', () => {
    const rects = gridToRectangles(['#.#'], 10, '#');
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(rects[1]).toEqual({ x: 20, y: 0, w: 10, h: 10 });
  });

  it('handles a run reaching the end of the row', () => {
    expect(gridToRectangles(['###'], 10, '#')).toHaveLength(1);
  });
});

describe('loadLevel', () => {
  it('builds solids, platforms and world size from the grid', () => {
    const level = loadLevel(RAW);
    expect(level.worldWidth).toBe(64); // 4 columns * 16
    expect(level.worldHeight).toBe(32); // 2 rows * 16
    expect(level.solids.length).toBeGreaterThan(0);
    expect(level.oneWayPlatforms).toEqual([{ x: 32, y: 16, w: 32, h: 16 }]);
  });

  it('fills sensible defaults', () => {
    const level = loadLevel(RAW);
    expect(level.viewport).toEqual({ width: 960, height: 540 });
    expect(level.checkpoint).toEqual(level.playerStart);
    expect(level.camera.maxX).toBe(0); // world narrower than viewport
    expect(level.tileset).toBe('placeholder');
  });

  it('freezes the result to protect content from mutation', () => {
    const level = loadLevel(RAW);
    expect(Object.isFrozen(level)).toBe(true);
  });

  it('rejects a level without a target item', () => {
    const raw = { ...RAW, items: [] };
    expect(() => loadLevel(raw)).toThrow(/at least one item of type "target"/);
  });

  it('rejects rows of different widths', () => {
    const raw = { ...RAW, map: { solid: ['###', '##'] } };
    expect(() => loadLevel(raw)).toThrow(LevelValidationError);
  });

  it('rejects duplicate item ids', () => {
    const item = { id: 'dup', type: 'target', kind: 'letter', label: 'A', x: 0, y: 0, w: 16, h: 16 };
    const raw = { ...RAW, items: [item, { ...item }] };
    expect(() => loadLevel(raw)).toThrow(/duplicated item id/);
  });

  it('rejects items outside the world', () => {
    const raw = {
      ...RAW,
      items: [{ id: 'far', type: 'target', kind: 'letter', label: 'A', x: 900, y: 0, w: 16, h: 16 }],
    };
    expect(() => loadLevel(raw)).toThrow(/outside the world/);
  });

  it('requires id, name and solid rows', () => {
    expect(() => loadLevel({ ...RAW, id: undefined })).toThrow(/"id"/);
    expect(() => loadLevel({ ...RAW, name: undefined })).toThrow(/"name"/);
    expect(() => loadLevel({ ...RAW, map: {} })).toThrow(/map.solid/);
  });

  it('rejects a non-object payload', () => {
    expect(() => loadLevel(null)).toThrow(LevelValidationError);
  });
});
