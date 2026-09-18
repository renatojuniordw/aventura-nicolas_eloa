import { PHYSICS, PLAYER } from '../../core/config.js';
import { PlayerStateId, PlayerState, type PlayerStateIdValue } from './player-state.js';
import { IdleState } from './states/idle-state.js';
import { WalkState } from './states/walk-state.js';
import { JumpState } from './states/jump-state.js';
import { FallState } from './states/fall-state.js';
import type { Body } from '../../physics/physics-engine.js';
import type { Box } from '../../physics/aabb.js';

export interface PhysicsLike {
  applyGravity(body: Body, dt: number, overrides?: { gravity?: number; maxFallSpeed?: number }): void;
  move(body: Body, dt: number, level: { solids?: Box[]; oneWayPlatforms?: Box[] }): unknown;
}

export interface PlayerLevel {
  solids?: Box[];
  oneWayPlatforms?: Box[];
  physics?: { gravity?: number; maxFallSpeed?: number };
}

type PlayerConfig = typeof PHYSICS & typeof PLAYER;

interface PlayerControllerOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  physics: PhysicsLike;
  config?: Partial<PlayerConfig>;
}

/**
 * The semantic layer between abstracted input and physics.
 *
 * This is the ONLY place that decides *what a jump means* (grounded? coyote
 * time? buffered?). Input sources — keyboard today, ESP32 tomorrow — never
 * reach this logic; they only trigger the public methods below:
 *
 *   moveLeft() / moveRight() / stop()  -> continuous intent
 *   jump()                             -> buffered jump request
 *   holdJump(boolean)                  -> variable jump height
 *
 * Keeping the jump decision here (and never inside a key handler) is a hard
 * architectural requirement of this project.
 */
export class PlayerController {
  body: Body;
  spawn: { x: number; y: number };
  facing: 1 | -1;
  /** -1 left, 0 none, 1 right. Set through the semantic move methods. */
  moveIntent: -1 | 0 | 1;

  private _physics: PhysicsLike;
  private _config: PlayerConfig;
  private _jumpBufferTimer = 0;
  private _coyoteTimer = 0;
  private _airJumpsRemaining = 0;
  private _jumpHeld = false;
  private _jumpCutPending = false;
  private _states: Map<PlayerStateIdValue, PlayerState>;
  private _state!: PlayerState;

  constructor({ x, y, width = PLAYER.width, height = PLAYER.height, physics, config = {} }: PlayerControllerOptions) {
    if (!physics) throw new TypeError('PlayerController requires a physics engine');

    this._physics = physics;
    this._config = { ...PHYSICS, ...PLAYER, ...config };
    this.body = { x, y, w: width, h: height, vx: 0, vy: 0, grounded: false };
    this.spawn = { x, y };
    this.facing = 1;
    this.moveIntent = 0;

    this._states = new Map<PlayerStateIdValue, PlayerState>([
      [PlayerStateId.IDLE, new IdleState(this)],
      [PlayerStateId.WALK, new WalkState(this)],
      [PlayerStateId.JUMP, new JumpState(this)],
      [PlayerStateId.FALL, new FallState(this)],
    ]);
    this.setState(PlayerStateId.IDLE);
  }

  /** @returns current state id */
  get state(): PlayerStateIdValue | 'base' {
    return this._state.id;
  }

  get grounded(): boolean {
    return this.body.grounded;
  }

  // ---------------------------------------------------------------------------
  // Semantic input API — called by the scene, never by a raw key handler.
  // ---------------------------------------------------------------------------

  moveLeft(): void {
    this.moveIntent = -1;
  }

  moveRight(): void {
    this.moveIntent = 1;
  }

  stop(): void {
    this.moveIntent = 0;
  }

  /**
   * Buffered request: pressing slightly before landing still jumps. If
   * already airborne outside the coyote window, this instead spends an air
   * jump immediately — there's no landing to buffer for.
   */
  jump(): void {
    console.log('[player-controller] pedido de jump recebido');
    if (!this.body.grounded && this._coyoteTimer <= 0 && this._airJumpsRemaining > 0) {
      this._performAirJump();
      return;
    }
    this._jumpBufferTimer = this._config.jumpBufferTime;
  }

  /** Whether the jump action is still held (drives variable jump height). */
  holdJump(held: boolean): void {
    this._jumpHeld = Boolean(held);
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  /** @param dt fixed timestep */
  update(dt: number, level: PlayerLevel): void {
    this._tickTimers(dt);
    this._tryBufferedJump();
    this._state.update(dt);
    this._applyJumpCut();
    this._physics.applyGravity(this.body, dt, level.physics ?? {});
    this._physics.move(this.body, dt, level);
    this._refreshGrounding();
    this._refreshFacing();
  }

  /** Used by states: instant stop/run on the ground. */
  applyGroundMovement(): void {
    this.body.vx = this.moveIntent * this._config.walkSpeed;
  }

  /** Used by states: reduced steering mid-air, momentum kept when no input. */
  applyAirMovement(): void {
    if (this.moveIntent !== 0) {
      this.body.vx = this.moveIntent * this._config.walkSpeed * this._config.airControl;
    }
  }

  /** Swap the active state. */
  setState(stateId: PlayerStateIdValue): void {
    const next = this._states.get(stateId);
    if (!next) throw new Error(`Unknown player state: ${stateId}`);
    if (this._state === next) return;
    this._state?.exit();
    this._state = next;
    this._state.enter();
  }

  /** Teleport back to a spawn/checkpoint and clear transient motion. */
  reset(position: { x: number; y: number } = this.spawn): void {
    this.body.x = position.x;
    this.body.y = position.y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.grounded = false;
    this.moveIntent = 0;
    this._jumpBufferTimer = 0;
    this._coyoteTimer = 0;
    this._airJumpsRemaining = this._config.maxAirJumps;
    this._jumpHeld = false;
    this._jumpCutPending = false;
    this.setState(PlayerStateId.IDLE);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private _tickTimers(dt: number): void {
    this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt);
    this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);
  }

  private _tryBufferedJump(): void {
    const canJump = this.body.grounded || this._coyoteTimer > 0;
    if (this._jumpBufferTimer > 0 && canJump) {
      this._performJump();
    }
  }

  private _performJump(): void {
    console.log('[player-controller] jump executado (aplicando jumpVelocity)');
    this.body.vy = this._config.jumpVelocity;
    this.body.grounded = false;
    this._jumpBufferTimer = 0;
    this._coyoteTimer = 0;
    this._jumpCutPending = true;
    this.setState(PlayerStateId.JUMP);
  }

  /** Same impulse as a ground jump — an assist, so it needs real reach to clear tall obstacles. */
  private _performAirJump(): void {
    console.log('[player-controller] air jump executado (pulo duplo)');
    this._airJumpsRemaining -= 1;
    this.body.vy = this._config.jumpVelocity;
    this._jumpCutPending = true;
    this.setState(PlayerStateId.JUMP);
  }

  /** Releasing jump early shortens the arc (applied once per jump). */
  private _applyJumpCut(): void {
    if (this._jumpCutPending && !this._jumpHeld && this.body.vy < 0) {
      this.body.vy = Math.max(
        this.body.vy,
        this._config.jumpVelocity * this._config.jumpCutMultiplier,
      );
      this._jumpCutPending = false;
    }
  }

  private _refreshGrounding(): void {
    if (this.body.grounded) {
      this._coyoteTimer = this._config.coyoteTime;
      this._airJumpsRemaining = this._config.maxAirJumps;
    }
  }

  private _refreshFacing(): void {
    if (this.moveIntent !== 0) {
      this.facing = this.moveIntent;
    }
  }
}
