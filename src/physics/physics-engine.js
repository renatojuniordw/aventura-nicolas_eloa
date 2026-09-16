import { PHYSICS } from '../core/config.js';
import { overlap } from './aabb.js';

/**
 * Width of one broad-phase bucket, in pixels. Rectangles are indexed by the
 * buckets their x-range touches, so collision queries only scan geometry near
 * the body instead of every solid in the level. Matters once a level's world
 * gets wide (e.g. the ~50,000px Speed Run course), where a flat per-frame
 * scan of every solid would otherwise grow with total level size instead of
 * local density.
 */
const BUCKET_SIZE = 256;

/** Builds `x-bucket -> rectangles touching it` from a solids/platforms array. */
function buildSpatialIndex(rects) {
  const buckets = new Map();
  for (const rect of rects) {
    const start = Math.floor(rect.x / BUCKET_SIZE);
    const end = Math.floor((rect.x + rect.w - 1) / BUCKET_SIZE);
    for (let bucket = start; bucket <= end; bucket += 1) {
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(rect);
    }
  }
  return buckets;
}

/** Rectangles whose bucket range overlaps [left, right], deduplicated. */
function queryRange(index, left, right) {
  const startBucket = Math.floor(left / BUCKET_SIZE);
  const endBucket = Math.floor(right / BUCKET_SIZE);
  const seen = new Set();
  const result = [];
  for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
    const entries = index.get(bucket);
    if (!entries) continue;
    for (const rect of entries) {
      if (seen.has(rect)) continue;
      seen.add(rect);
      result.push(rect);
    }
  }
  return result;
}

/**
 * Movement, gravity and collision resolution. Pure simulation: it never reads
 * input, never draws, never knows about letters or lives. It only understands
 * bodies and solid rectangles, which keeps it reusable and unit-testable.
 *
 * A body is `{ x, y, w, h, vx, vy, grounded }`.
 */
export class PhysicsEngine {
  constructor(config = PHYSICS) {
    this.config = config;
    /** Spatial index cache keyed by the rectangle array's identity (levels are frozen, so this is stable). */
    this._indexCache = new WeakMap();
  }

  /** Returns (and lazily builds/caches) the broad-phase index for a rectangle array. */
  _indexFor(rects) {
    let index = this._indexCache.get(rects);
    if (!index) {
      index = buildSpatialIndex(rects);
      this._indexCache.set(rects, index);
    }
    return index;
  }

  /** Rectangles near [left, right] in `rects`, via the cached broad-phase index. */
  _nearby(rects, left, right) {
    if (rects.length === 0) return rects;
    return queryRange(this._indexFor(rects), left, right);
  }

  /** Integrate gravity into vertical velocity, clamped to terminal speed. */
  applyGravity(body, dt, overrides = {}) {
    const gravity = overrides.gravity ?? this.config.gravity;
    const maxFallSpeed = overrides.maxFallSpeed ?? this.config.maxFallSpeed;
    body.vy = Math.min(body.vy + gravity * dt, maxFallSpeed);
  }

  /**
   * Move the body by its velocity and resolve collisions axis by axis.
   *
   * X is resolved first, then Y, so a body sliding along the floor keeps its
   * horizontal motion and a body hitting a ceiling keeps its forward motion.
   *
   * @param {{x:number,y:number,w:number,h:number,vx:number,vy:number,grounded:boolean}} body
   * @param {number} dt
   * @param {{ solids: Array, oneWayPlatforms?: Array }} level
   * @returns {{ top:boolean, bottom:boolean, left:boolean, right:boolean }}
   */
  move(body, dt, level) {
    const solids = level.solids ?? [];
    const oneWay = level.oneWayPlatforms ?? [];
    const dx = body.vx * dt;
    const dy = body.vy * dt;
    const collisions = { top: false, bottom: false, left: false, right: false };

    // --- Horizontal axis ---
    body.x += dx;
    for (const solid of this._nearby(solids, body.x, body.x + body.w)) {
      if (!overlap(body, solid)) continue;
      if (dx > 0) {
        body.x = solid.x - body.w;
        body.vx = 0;
        collisions.right = true;
      } else if (dx < 0) {
        body.x = solid.x + solid.w;
        body.vx = 0;
        collisions.left = true;
      }
    }

    // --- Vertical axis ---
    const previousBottom = body.y + body.h;
    body.y += dy;
    body.grounded = false;
    for (const solid of this._nearby(solids, body.x, body.x + body.w)) {
      if (!overlap(body, solid)) continue;
      if (dy > 0) {
        body.y = solid.y - body.h;
        body.vy = 0;
        collisions.bottom = true;
        body.grounded = true;
      } else if (dy < 0) {
        body.y = solid.y + solid.h;
        body.vy = 0;
        collisions.top = true;
      }
    }

    // --- One-way platforms: solid only when falling and feet were above ---
    if (dy >= 0) {
      for (const platform of this._nearby(oneWay, body.x, body.x + body.w)) {
        if (!overlap(body, platform)) continue;
        if (previousBottom <= platform.y) {
          body.y = platform.y - body.h;
          body.vy = 0;
          collisions.bottom = true;
          body.grounded = true;
        }
      }
    }

    return collisions;
  }

  /** True when the body's feet are resting on solid ground below it. */
  isGrounded(body, level) {
    const probe = { x: body.x, y: body.y + 1, w: body.w, h: body.h };
    const nearbySolids = this._nearby(level.solids ?? [], body.x, body.x + body.w);
    const nearbyPlatforms = this._nearby(level.oneWayPlatforms ?? [], body.x, body.x + body.w);
    return (
      nearbySolids.some((surface) => overlap(probe, surface)) ||
      nearbyPlatforms.some((surface) => overlap(probe, surface))
    );
  }
}
