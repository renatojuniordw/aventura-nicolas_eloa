import { describe, it, expect } from 'vitest';
import { PlayerController } from './player-controller.js';
import { PhysicsEngine } from '../../physics/physics-engine.js';
import { PlayerStateId } from './player-state.js';

const DT = 1 / 60;
const FLOOR = { x: 0, y: 100, w: 1000, h: 40 };
const LEVEL = { solids: [FLOOR], oneWayPlatforms: [] };

function createPlayer({ x = 80, y = 58 } = {}) {
  return new PlayerController({ x, y, physics: new PhysicsEngine() });
}

function settle(player, frames = 5, level = LEVEL) {
  for (let i = 0; i < frames; i += 1) {
    player.update(DT, level);
  }
}

describe('PlayerController', () => {
  it('starts in the idle state', () => {
    expect(createPlayer().state).toBe(PlayerStateId.IDLE);
  });

  it('rests on the floor and reports grounded', () => {
    const player = createPlayer();
    settle(player);
    expect(player.grounded).toBe(true);
    expect(player.body.y).toBeCloseTo(58, 0);
  });

  it('jumps only when grounded', () => {
    const player = createPlayer();
    settle(player);

    player.holdJump(true);
    player.jump();
    player.update(DT, LEVEL);

    expect(player.state).toBe(PlayerStateId.JUMP);
    expect(player.body.vy).toBeLessThan(-500);
  });

  it('ignores a jump request while airborne (no double jump in v1)', () => {
    const player = createPlayer();
    settle(player);
    player.holdJump(true);
    player.jump();
    player.update(DT, LEVEL);

    // Request a jump on every airborne frame; a second impulse would suddenly
    // make vy more negative. Gravity alone must only ever raise it toward 0.
    let previous = player.body.vy;
    let reaccelerated = false;
    for (let i = 0; i < 5; i += 1) {
      player.jump();
      player.update(DT, LEVEL);
      if (player.body.vy < previous - 1) reaccelerated = true;
      previous = player.body.vy;
    }

    expect(reaccelerated).toBe(false);
    expect(player.state).toBe(PlayerStateId.JUMP);
  });

  it('allows a jump during coyote time after stepping off a ledge', () => {
    const level = { solids: [{ x: 0, y: 100, w: 100, h: 40 }], oneWayPlatforms: [] };
    const player = createPlayer({ x: 80, y: 58 });
    settle(player, 3, level);

    player.moveRight();
    for (let i = 0; i < 12 && player.grounded; i += 1) {
      player.update(DT, level);
    }
    expect(player.grounded).toBe(false);

    player.holdJump(true);
    player.jump();
    player.update(DT, level);
    expect(player.state).toBe(PlayerStateId.JUMP);
    expect(player.body.vy).toBeLessThan(0);
  });

  it('buffers a jump pressed shortly before landing', () => {
    const player = createPlayer({ x: 200, y: 57 });
    player.holdJump(true);
    player.jump();

    let jumped = false;
    for (let i = 0; i < 6 && !jumped; i += 1) {
      player.update(DT, LEVEL);
      if (player.body.vy < -100) jumped = true;
    }
    expect(jumped).toBe(true);
    expect(player.state).toBe(PlayerStateId.JUMP);
  });

  it('cuts the jump short when the action is released early', () => {
    const held = createPlayer();
    settle(held);
    held.holdJump(true);
    held.jump();
    held.update(DT, LEVEL);
    const heldSpeed = held.body.vy;

    const released = createPlayer();
    settle(released);
    released.holdJump(false);
    released.jump();
    released.update(DT, LEVEL);
    const releasedSpeed = released.body.vy;

    // Releasing early yields a much smaller upward velocity.
    expect(releasedSpeed).toBeGreaterThan(heldSpeed);
  });

  it('moves right at walk speed while grounded', () => {
    const player = createPlayer();
    settle(player);
    player.moveRight();
    player.update(DT, LEVEL);
    expect(player.body.vx).toBeCloseTo(260);
    expect(player.facing).toBe(1);
  });

  it('transitions idle -> walk -> idle', () => {
    const player = createPlayer();
    settle(player);
    expect(player.state).toBe(PlayerStateId.IDLE);

    player.moveRight();
    player.update(DT, LEVEL);
    player.update(DT, LEVEL);
    expect(player.state).toBe(PlayerStateId.WALK);

    player.stop();
    player.update(DT, LEVEL);
    expect(player.state).toBe(PlayerStateId.IDLE);
  });

  it('transitions to fall after the jump apex', () => {
    const player = createPlayer();
    settle(player);
    player.holdJump(true);
    player.jump();
    player.update(DT, LEVEL);
    expect(player.state).toBe(PlayerStateId.JUMP);

    for (let i = 0; i < 60 && player.state === PlayerStateId.JUMP; i += 1) {
      player.update(DT, LEVEL);
    }
    expect(player.state).toBe(PlayerStateId.FALL);
  });

  it('reset returns to spawn and clears motion', () => {
    const player = createPlayer();
    settle(player);
    player.moveRight();
    player.update(DT, LEVEL);

    player.reset();
    expect(player.body.x).toBe(80);
    expect(player.body.y).toBe(58);
    expect(player.body.vx).toBe(0);
    expect(player.body.vy).toBe(0);
    expect(player.state).toBe(PlayerStateId.IDLE);
  });

  it('requires a physics engine', () => {
    expect(() => new PlayerController({ x: 0, y: 0 })).toThrow(TypeError);
  });
});
