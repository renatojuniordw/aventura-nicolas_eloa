import { describe, it, expect } from 'vitest';
import { WorldStream, PORTAL_SIZE, KEEP_BEHIND_SEGMENTS, templateSpots } from './world-stream.js';
import { SEGMENT_WIDTH, TEMPLATE_IDS, isTapReachable } from './speedrun-course.js';
import { createSpeedrunStream, speedrunDistractors, ALPHABET } from './stream-courses.js';
import { getLevelData } from '../content/level-registry.js';
import { loadLevel } from '../content/level-loader.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { PlayerController } from './player/player-controller.js';
import { overlap } from '../physics/aabb.js';
import { GAMEPLAY } from '../core/config.js';

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

  describe('bounded window (long runs)', () => {
    it('keeps segments, geometry and items bounded however far the player runs', () => {
      const stream = makeStream(11);
      let maxSolids = 0;
      let maxItems = 0;
      let maxSegments = 0;
      for (let x = 96; x < SEGMENT_WIDTH * 2000; x += 800) {
        stream.update(x);
        maxSolids = Math.max(maxSolids, stream.level.solids.length);
        maxItems = Math.max(maxItems, stream.level.items.length);
        maxSegments = Math.max(maxSegments, stream.segmentCount);
        expect(targets(stream)).toHaveLength(1);
      }
      // Behind + the player's own + lookahead, plus the one placement may add.
      expect(maxSegments).toBeLessThanOrEqual(KEEP_BEHIND_SEGMENTS + 1 + 2 + 2);
      expect(maxSolids).toBeLessThan(400);
      expect(maxItems).toBeLessThan(40);
    });

    it('closes the world with a wall where old segments were dropped, and the camera stops there', () => {
      const stream = makeStream();
      const playerX = SEGMENT_WIDTH * 10 + 500;
      for (let x = 96; x <= playerX; x += 700) stream.update(x);
      const dropX = (10 - KEEP_BEHIND_SEGMENTS) * SEGMENT_WIDTH;

      expect(stream.level.camera.minX).toBe(dropX);
      const wall = stream.level.solids.find((box) => box.x + box.w === dropX);
      expect(wall).toBeDefined();
      expect(wall!.y).toBeLessThan(0);
      expect(wall!.y + wall!.h).toBe(stream.level.worldHeight);
      // Nothing older than the window survives.
      for (const box of [...stream.level.oneWayPlatforms, ...stream.level.hazards, ...stream.level.items]) {
        expect(box.x).toBeGreaterThanOrEqual(dropX);
      }
    });

    it('respawns on ground inside the window anywhere the player can be', () => {
      const stream = makeStream(5);
      for (let x = 96; x < SEGMENT_WIDTH * 30; x += 450) {
        stream.update(x);
        const point = stream.checkpointFor(x);
        expect(point.x).toBeGreaterThanOrEqual(stream.level.camera.minX);
        const ground = stream.level.solids.some(
          (box) => box.y === 448 && point.x >= box.x && point.x + 30 <= box.x + box.w,
        );
        expect(ground, `checkpoint ${point.x}`).toBe(true);
      }
    });

    it('stitches templates with ground on both sides of every seam', () => {
      for (let seed = 1; seed <= 20; seed += 1) {
        const stream = makeStream(seed);
        stream.update(SEGMENT_WIDTH * 3);
        const covered = (x: number) =>
          stream.level.solids.some((box) => box.y === 448 && x >= box.x && x < box.x + box.w);
        const firstSeam = Math.ceil(stream.level.camera.minX / SEGMENT_WIDTH) + 1;
        for (let k = firstSeam; k * SEGMENT_WIDTH < stream.level.worldWidth; k += 1) {
          expect(covered(k * SEGMENT_WIDTH - 16), `seed ${seed} seam ${k}`).toBe(true);
          expect(covered(k * SEGMENT_WIDTH + 16), `seed ${seed} seam ${k}`).toBe(true);
        }
      }
    });
  });

  describe('target changes (alphabet marathon)', () => {
    it('never leaves a distractor that is the current answer or outside its pool, A to Z', () => {
      for (let seed = 1; seed <= 10; seed += 1) {
        const stream = createSpeedrunStream({ random: seeded(seed) });
        let x = 96;
        for (const letter of ALPHABET.slice(1)) {
          x += 700;
          stream.update(x);
          stream.setTarget(letter, x);
          const pool = new Set(speedrunDistractors(letter));
          for (const item of stream.level.items.filter((i) => i.type === 'distractor')) {
            expect(item.label, `seed ${seed} target ${letter}`).not.toBe(letter);
            expect(pool.has(item.label), `seed ${seed} target ${letter} has ${item.label}`).toBe(true);
          }
          expect(targets(stream)).toHaveLength(1);
          expect(stream.liveTarget!.label).toBe(letter);
        }
      }
    });

    it('reports withdrawn distractors once, so the scene can pop the visible ones', () => {
      const stream = createSpeedrunStream({ random: seeded(3) });
      const c = stream.level.items.find((item) => item.label === 'C') ?? stream.level.items[0];
      c.label = 'C';
      c.type = 'distractor';
      stream.drainWithdrawn();

      stream.setTarget('B');
      stream.setTarget('C');
      const withdrawn = stream.drainWithdrawn();
      expect(withdrawn.map((item) => item.id)).toContain(c.id);
      expect(stream.level.items).not.toContain(c);
      expect(stream.drainWithdrawn()).toEqual([]);
    });

    it('allows neighbour letters only when the challenge support asks for them', () => {
      expect(speedrunDistractors('C')).not.toContain('B');
      expect(speedrunDistractors('C')).not.toContain('D');
      expect(speedrunDistractors('C', { allowNeighbourLetters: true })).toContain('B');
      expect(speedrunDistractors('C', { allowNeighbourLetters: true })).not.toContain('C');
    });
  });

  describe('target availability', () => {
    it('still places the target when every spot ahead is taken, withdrawing a distractor for it', () => {
      const stream = makeStream();
      const internals = stream as unknown as { _segments: { spots: { x: number; y: number }[] }[] };
      // Occupy every known spot with a distractor.
      const spots = internals._segments.flatMap((segment) => segment.spots);
      stream.level.items = spots.map((spot, i) => ({
        id: `filler-${i}`, kind: 'letter', type: 'distractor' as const, label: 'X', x: spot.x, y: spot.y, w: 32, h: 32,
      }));
      // No room to grow either: pretend the world cannot extend.
      const extend = (stream as unknown as { _extendTo: (x: number) => void });
      const original = extend._extendTo;
      extend._extendTo = () => {};
      stream.drainWithdrawn();

      stream.setTarget('B', 96);

      expect(targets(stream)).toHaveLength(1);
      expect(stream.drainWithdrawn().length).toBeGreaterThan(0);
      extend._extendTo = original;
    });

    it('re-offers a target on the next update if none is in the world', () => {
      const stream = makeStream();
      stream.level.items = stream.level.items.filter((item) => item.type !== 'target');
      stream.update(500);
      expect(targets(stream)).toHaveLength(1);
      expect(stream.liveTarget!.x).toBeGreaterThanOrEqual(500 + 900);
    });

    it('works with an empty distractor pool', () => {
      const stream = new WorldStream({ id: 't', name: 't', target: 'A', distractorPool: () => [], random: seeded(2) });
      for (let x = 96; x < SEGMENT_WIDTH * 8; x += 900) stream.update(x);
      expect(stream.level.items.filter((item) => item.type === 'distractor')).toHaveLength(0);
      expect(targets(stream)).toHaveLength(1);
    });

    it('has tap-reachable spots in every template, at least the two kept free for the target', () => {
      TEMPLATE_IDS.forEach((id, index) => {
        const template = loadLevel(getLevelData(id)!) as unknown as Parameters<typeof templateSpots>[1];
        const spots = templateSpots(index, template);
        const supports = [...template.solids, ...template.oneWayPlatforms];
        // "Degraus" has only two: it then gets no distractors, and the target always fits.
        expect(spots.length, id).toBeGreaterThanOrEqual(2);
        for (const spot of spots) expect(isTapReachable(spot, supports), `${id} ${spot.x}`).toBe(true);
      });
    });

    it('lets the real player physics touch every spot with one quick tap, and never by just walking', () => {
      const physics = new PhysicsEngine();
      TEMPLATE_IDS.forEach((id, index) => {
        const template = loadLevel(getLevelData(id)!) as unknown as Parameters<typeof templateSpots>[1];
        const level = { solids: template.solids, oneWayPlatforms: template.oneWayPlatforms };
        for (const spot of templateSpots(index, template)) {
          const item = { x: spot.x - GAMEPLAY.itemPickupMargin, y: spot.y - GAMEPLAY.itemPickupMargin, w: 32 + GAMEPLAY.itemPickupMargin * 2, h: 32 + GAMEPLAY.itemPickupMargin * 2 };
          const player = new PlayerController({ x: spot.x + 1, y: 0, physics });
          // Let the player land on whatever is under the spot.
          for (let i = 0; i < 120; i += 1) player.update(1 / 60, level);
          let touchedStanding = false;
          for (let i = 0; i < 30; i += 1) {
            player.update(1 / 60, level);
            touchedStanding ||= overlap(player.body, item);
          }
          expect(touchedStanding, `${id} ${spot.x}: reachable without jumping`).toBe(false);

          player.jump();
          player.holdJump(false);
          let touched = false;
          for (let i = 0; i < 90; i += 1) {
            player.update(1 / 60, level);
            touched ||= overlap(player.body, item);
          }
          expect(touched, `${id} ${spot.x}: not reached by a tap`).toBe(true);
        }
      });
    });
  });

  describe('portal arrival', () => {
    it('is idempotent: opening twice keeps the same portal and world', () => {
      const stream = makeStream();
      const first = stream.spawnPortal(800);
      const width = stream.level.worldWidth;
      const second = stream.spawnPortal(1500);
      expect(second).toEqual(first);
      expect(stream.level.worldWidth).toBe(width);
    });

    it('clears every letter, so nothing can cost a heart after the objective', () => {
      const stream = makeStream();
      stream.drainWithdrawn();
      const before = stream.level.items.length;
      stream.spawnPortal(800);
      expect(stream.level.items).toEqual([]);
      expect(stream.drainWithdrawn()).toHaveLength(before);
    });

    it('keeps the whole portal inside the camera when the camera lags behind the player', () => {
      const stream = makeStream();
      const playerX = 2400;
      const visibleRight = playerX + 450; // camera still easing toward the player
      const finish = stream.spawnPortal(playerX, { visibleRight });
      expect(finish.x + PORTAL_SIZE.w).toBeLessThanOrEqual(visibleRight);
      expect(finish.x).toBeGreaterThan(playerX + 100);
    });

    it('respawns on the arrival ground once past the cut, and on preserved ground before it', () => {
      const stream = makeStream(4);
      const playerX = SEGMENT_WIDTH + 1800;
      stream.update(playerX);
      const finish = stream.spawnPortal(playerX);
      const ground = (x: number) =>
        stream.level.solids.some((box) => box.y === 448 && x >= box.x && x + 30 <= box.x + box.w);

      const past = stream.checkpointFor(finish.x);
      expect(past.x).toBeLessThan(finish.x);
      expect(ground(past.x)).toBe(true);

      const before = stream.checkpointFor(playerX);
      expect(before.x).toBeLessThan(finish.x);
      expect(ground(before.x)).toBe(true);
    });
  });
});

