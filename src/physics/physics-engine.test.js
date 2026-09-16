import { describe, it, expect } from 'vitest';
import { PhysicsEngine } from './physics-engine.js';

function makeBody(overrides = {}) {
  return { x: 0, y: 0, w: 10, h: 10, vx: 0, vy: 0, grounded: false, ...overrides };
}

describe('PhysicsEngine.applyGravity', () => {
  it('adds gravity over time', () => {
    const engine = new PhysicsEngine({ gravity: 1500, maxFallSpeed: 900 });
    const body = makeBody();
    engine.applyGravity(body, 0.1);
    expect(body.vy).toBeCloseTo(150);
  });

  it('clamps to terminal velocity', () => {
    const engine = new PhysicsEngine({ gravity: 1500, maxFallSpeed: 900 });
    const body = makeBody({ vy: 880 });
    engine.applyGravity(body, 1);
    expect(body.vy).toBe(900);
  });

  it('honours per-level overrides', () => {
    const engine = new PhysicsEngine({ gravity: 1500, maxFallSpeed: 900 });
    const body = makeBody();
    engine.applyGravity(body, 0.1, { gravity: 500 });
    expect(body.vy).toBeCloseTo(50);
  });
});

describe('PhysicsEngine.move', () => {
  const engine = new PhysicsEngine();

  it('resolves a right-wall collision', () => {
    // Realistic per-step displacement (~13px at 260 px/s), no tunnelling.
    const body = makeBody({ x: 40, vx: 260 });
    const level = { solids: [{ x: 50, y: 0, w: 10, h: 10 }] };
    const collisions = engine.move(body, 0.05, level);
    expect(collisions.right).toBe(true);
    expect(body.x).toBe(40);
    expect(body.vx).toBe(0);
  });

  it('resolves a left-wall collision', () => {
    const body = makeBody({ x: 60, vx: -260 });
    const level = { solids: [{ x: 50, y: 0, w: 10, h: 10 }] };
    const collisions = engine.move(body, 0.05, level);
    expect(collisions.left).toBe(true);
    expect(body.x).toBe(60);
  });

  it('lands on the floor and becomes grounded', () => {
    const body = makeBody({ y: 0, vy: 100 });
    const level = { solids: [{ x: 0, y: 50, w: 200, h: 10 }] };
    const collisions = engine.move(body, 0.5, level);
    expect(collisions.bottom).toBe(true);
    expect(body.grounded).toBe(true);
    expect(body.y).toBe(40);
    expect(body.vy).toBe(0);
  });

  it('hits the ceiling', () => {
    const body = makeBody({ y: 0, vy: -100 });
    const level = { solids: [{ x: 0, y: -45, w: 200, h: 10 }] };
    const collisions = engine.move(body, 0.5, level);
    expect(collisions.top).toBe(true);
    expect(body.y).toBe(-35);
    expect(body.vy).toBe(0);
  });

  it('lands on a one-way platform when falling from above', () => {
    const body = makeBody({ y: 30, vy: 100 });
    const level = { solids: [], oneWayPlatforms: [{ x: 0, y: 50, w: 100, h: 10 }] };
    const collisions = engine.move(body, 0.2, level);
    expect(collisions.bottom).toBe(true);
    expect(body.grounded).toBe(true);
    expect(body.y).toBe(40);
  });

  it('passes through a one-way platform when rising from below', () => {
    const body = makeBody({ y: 60, vy: -100 });
    const level = { solids: [], oneWayPlatforms: [{ x: 0, y: 50, w: 100, h: 10 }] };
    const collisions = engine.move(body, 0.1, level);
    expect(collisions.bottom).toBe(false);
    expect(body.y).toBe(50);
  });

  it('reports grounding via isGrounded', () => {
    const body = makeBody({ y: 40 });
    const level = { solids: [{ x: 0, y: 50, w: 200, h: 10 }] };
    expect(engine.isGrounded(body, level)).toBe(true);

    const airborne = makeBody({ y: 0 });
    expect(engine.isGrounded(airborne, level)).toBe(false);
  });
});
