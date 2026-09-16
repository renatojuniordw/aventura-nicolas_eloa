import { PHYSICS } from '../core/config.js';
import { overlap } from './aabb.js';

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
    for (const solid of solids) {
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
    for (const solid of solids) {
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
      for (const platform of oneWay) {
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
    const surfaces = [...(level.solids ?? []), ...(level.oneWayPlatforms ?? [])];
    return surfaces.some((surface) => overlap(probe, surface));
  }
}
