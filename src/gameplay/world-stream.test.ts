import { describe, it, expect } from 'vitest';
import { WorldStream, PORTAL_SIZE } from './world-stream.js';
import { SEGMENT_WIDTH, isTapReachable } from './speedrun-course.js';

/** Deterministic pseudo-random source so layouts are reproducible. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const POOL = ['X', 'Y', 'Z', 'K'];

function makeStream(seed = 7) {
  return new WorldStream({
    id: 'test',
    name: 'Teste',
    target: 'A',
    distractorPool: () => POOL,
    random: seeded(seed),
  });
}

const targets = (stream: WorldStream) => stream.level.items.filter((item) => item.type === 'target');

describe('WorldStream', () => {
  it('starts with a few screens of ground, one target and only distractors from the pool', () => {
    const stream = makeStream();
    expect(stream.level.worldWidth).toBeGreaterThanOrEqual(SEGMENT_WIDTH * 3);
    expect(targets(stream)).toHaveLength(1);
    expect(targets(stream)[0].label).toBe('A');
    const distractors = stream.level.items.filter((item) => item.type === 'distractor');
    expect(distractors.length).toBeGreaterThan(0);
    for (const item of distractors) expect(POOL).toContain(item.label);
    expect(stream.level.portalActive).toBe(false);
    expect(stream.level.finish).toBeUndefined();
  });

  it('places every letter where a quick jump tap reaches it but a walker does not', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const stream = makeStream(seed);
      for (let x = 0; x < SEGMENT_WIDTH * 12; x += 800) stream.update(x);
      const supports = [...stream.level.solids, ...stream.level.oneWayPlatforms];
      for (const item of stream.level.items) {
        expect(isTapReachable(item, supports), `seed ${seed} ${item.id}`).toBe(true);
      }
    }
  });

  it('never stacks two items on the same spot', () => {
    const stream = makeStream();
    const { items } = stream.level;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const close = Math.abs(items[i].x - items[j].x) < 32 && Math.abs(items[i].y - items[j].y) < 32;
        expect(close).toBe(false);
      }
    }
  });

  it('keeps generating terrain ahead of the player, endlessly', () => {
    const stream = makeStream();
    let previous = stream.level.worldWidth;
    for (let x = 500; x < SEGMENT_WIDTH * 40; x += 700) {
      stream.update(x);
      expect(stream.level.worldWidth).toBeGreaterThanOrEqual(x + SEGMENT_WIDTH);
      previous = Math.max(previous, stream.level.worldWidth);
    }
    expect(previous).toBeGreaterThan(SEGMENT_WIDTH * 40);
    expect(stream.level.camera.maxX).toBe(Number.POSITIVE_INFINITY);
  });

  it('re-offers the target further ahead when the player runs past it', () => {
    const stream = makeStream();
    const first = stream.liveTarget!;

    // The player sails well past the letter without touching it.
    const playerX = first.x + 1500;
    stream.update(playerX);

    const again = stream.liveTarget!;
    expect(targets(stream)).toHaveLength(1);
    expect(again.label).toBe('A');
    expect(again.id).not.toBe(first.id);
    // Ahead of the player, and off-screen (viewport is 960 wide).
    expect(again.x).toBeGreaterThanOrEqual(playerX + 900);
  });

  it('lets other letters go by between two offers of the same target', () => {
    const stream = makeStream();
    const first = stream.liveTarget!;
    stream.update(first.x + 1500);
    const again = stream.liveTarget!;

    const between = stream.level.items.filter(
      (item) => item.type === 'distractor' && item.x > first.x + 1500 - 1 && item.x < again.x,
    );
    // Not guaranteed by any single layout, but distractors fill every segment, so a target
    // placed more than one segment away has other letters ahead of it on the way.
    const isFarther = again.x - (first.x + 1500) > SEGMENT_WIDTH;
    expect(!isFarther || between.length > 0).toBe(true);
  });

  it('always has exactly one live target, whatever the layout and however the player moves', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const stream = makeStream(seed);
      let x = 96;
      for (let step = 0; step < 60; step += 1) {
        x += 150 + ((seed * 37 + step * 91) % 900);
        stream.update(x);
        if (step % 7 === 3) stream.setTarget(step % 2 ? 'B' : 'C');
        expect(targets(stream), `seed ${seed} step ${step}`).toHaveLength(1);
        expect(stream.liveTarget!.x).toBeGreaterThan(x - 600);
      }
    }
  });

  it('does not withdraw a target that is merely a little behind', () => {
    const stream = makeStream();
    const first = stream.liveTarget!;
    stream.update(first.x + 300);
    expect(stream.liveTarget!.id).toBe(first.id);
  });

  it('replaces the target when a new one is requested, ahead of the player', () => {
    const stream = makeStream();
    stream.update(2000);
    stream.setTarget('B');

    expect(targets(stream)).toHaveLength(1);
    expect(targets(stream)[0].label).toBe('B');
    expect(targets(stream)[0].x).toBeGreaterThanOrEqual(2000 + 900);
  });

  it('assigns unique ids and picks a checkpoint at the start of the player segment', () => {
    const stream = makeStream();
    for (let x = 0; x < SEGMENT_WIDTH * 10; x += 500) stream.update(x);
    const ids = stream.level.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(stream.checkpointFor(50)).toEqual({ x: 96, y: 406 });
    expect(stream.checkpointFor(SEGMENT_WIDTH * 3 + 700)).toEqual({ x: SEGMENT_WIDTH * 3 + 96, y: 406 });
  });

  it('swaps the geometry arrays when terrain changes, so cached physics indexes never go stale', () => {
    const stream = makeStream();
    const solidsBefore = stream.level.solids;
    const version = stream.terrainVersion;
    stream.update(SEGMENT_WIDTH * 5);
    expect(stream.level.solids).not.toBe(solidsBefore);
    expect(stream.terrainVersion).toBeGreaterThan(version);
  });

  describe('portal', () => {
    it('seals the world ahead of the player with flat ground and a portal on it', () => {
      const stream = makeStream();
      stream.update(SEGMENT_WIDTH * 4);
      const playerX = SEGMENT_WIDTH * 4 + 200;
      stream.update(playerX);

      const finish = stream.spawnPortal(playerX);

      expect(stream.sealed).toBe(true);
      expect(stream.level.portalActive).toBe(true);
      expect(stream.level.finish).toEqual(finish);
      // Close enough to be on screen at once (the view shows ~620px ahead of the player), but not on top of them.
      expect(finish.x).toBeGreaterThan(playerX + 300);
      expect(finish.x + PORTAL_SIZE.w).toBeLessThan(playerX + 620);
      // Sits on the ground row.
      expect(finish.y + PORTAL_SIZE.h).toBe(448);
      // The world now ends: camera stops, nothing generated beyond it.
      expect(stream.level.camera.maxX).toBe(stream.level.worldWidth - 960);
      expect(stream.level.worldWidth).toBeGreaterThan(finish.x + PORTAL_SIZE.w);
      // No target remains, and nothing lives past the arrival ground.
      expect(targets(stream)).toHaveLength(0);
      const worldBefore = stream.level.worldWidth;
      stream.update(worldBefore);
      expect(stream.level.worldWidth).toBe(worldBefore);
    });

    it('has continuous ground under the portal and beyond it (no pit near the goal)', () => {
      const stream = makeStream(3);
      const playerX = 1000;
      stream.update(playerX);
      const finish = stream.spawnPortal(playerX);

      const ground = stream.level.solids.filter((box) => box.y === 448);
      const covered = (x: number) => ground.some((box) => x >= box.x && x < box.x + box.w);
      for (let x = finish.x - 200; x <= finish.x + PORTAL_SIZE.w + 400; x += 16) {
        expect(covered(x)).toBe(true);
      }
    });

    it('grows the portal in only when ticked, ending fully revealed', () => {
      const stream = makeStream();
      stream.spawnPortal(500);
      expect(stream.level.portalReveal).toBe(0);
      stream.tick(0.4);
      expect(stream.level.portalReveal).toBeGreaterThan(0);
      expect(stream.level.portalReveal).toBeLessThan(1);
      stream.tick(5);
      expect(stream.level.portalReveal).toBe(1);
    });

    it('ignores setTarget once sealed', () => {
      const stream = makeStream();
      stream.spawnPortal(500);
      stream.setTarget('B');
      expect(targets(stream)).toHaveLength(0);
    });
  });
});
