import { PHYSICS, PLAYER } from '../../core/config.js';
import { PlayerStateId } from './player-state.js';
import { IdleState } from './states/idle-state.js';
import { WalkState } from './states/walk-state.js';
import { JumpState } from './states/jump-state.js';
import { FallState } from './states/fall-state.js';

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
  constructor({
    x,
    y,
    width = PLAYER.width,
    height = PLAYER.height,
    physics,
    config = {},
  }) {
    if (!physics) throw new TypeError('PlayerController requires a physics engine');

    this._physics = physics;
    this._config = { ...PHYSICS, ...PLAYER, ...config };
    this.body = { x, y, w: width, h: height, vx: 0, vy: 0, grounded: false };
    this.spawn = { x, y };
    this.facing = 1;
    /** -1 left, 0 none, 1 right. Set through the semantic move methods. */
    this.moveIntent = 0;

    this._jumpBufferTimer = 0;
    this._coyoteTimer = 0;
    this._jumpHeld = false;
    this._jumpCutPending = false;

    this._states = new Map([
      [PlayerStateId.IDLE, new IdleState(this)],
      [PlayerStateId.WALK, new WalkState(this)],
      [PlayerStateId.JUMP, new JumpState(this)],
      [PlayerStateId.FALL, new FallState(this)],
    ]);
    this._state = null;
    this.setState(PlayerStateId.IDLE);
  }

  /** @returns {string} current state id */
  get state() {
    return this._state.id;
  }

  get grounded() {
    return this.body.grounded;
  }

  // ---------------------------------------------------------------------------
  // Semantic input API — called by the scene, never by a raw key handler.
  // ---------------------------------------------------------------------------

  moveLeft() {
    this.moveIntent = -1;
  }

  moveRight() {
    this.moveIntent = 1;
  }

  stop() {
    this.moveIntent = 0;
  }

  /** Buffered request: pressing slightly before landing still jumps. */
  jump() {
    this._jumpBufferTimer = this._config.jumpBufferTime;
  }

  /** Whether the jump action is still held (drives variable jump height). */
  holdJump(held) {
    this._jumpHeld = Boolean(held);
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  /**
   * @param {number} dt fixed timestep
   * @param {{ solids: Array, oneWayPlatforms?: Array, physics?: object }} level
   */
  update(dt, level) {
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
  applyGroundMovement() {
    this.body.vx = this.moveIntent * this._config.walkSpeed;
  }

  /** Used by states: reduced steering mid-air, momentum kept when no input. */
  applyAirMovement() {
    if (this.moveIntent !== 0) {
      this.body.vx = this.moveIntent * this._config.walkSpeed * this._config.airControl;
    }
  }

  /** Swap the active state. */
  setState(stateId) {
    const next = this._states.get(stateId);
    if (!next) throw new Error(`Unknown player state: ${stateId}`);
    if (this._state === next) return;
    this._state?.exit();
    this._state = next;
    this._state.enter();
  }

  /** Teleport back to a spawn/checkpoint and clear transient motion. */
  reset(position = this.spawn) {
    this.body.x = position.x;
    this.body.y = position.y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.grounded = false;
    this.moveIntent = 0;
    this._jumpBufferTimer = 0;
    this._coyoteTimer = 0;
    this._jumpHeld = false;
    this._jumpCutPending = false;
    this.setState(PlayerStateId.IDLE);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  _tickTimers(dt) {
    this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt);
    this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);
  }

  _tryBufferedJump() {
    const canJump = this.body.grounded || this._coyoteTimer > 0;
    if (this._jumpBufferTimer > 0 && canJump) {
      this._performJump();
    }
  }

  _performJump() {
    this.body.vy = this._config.jumpVelocity;
    this.body.grounded = false;
    this._jumpBufferTimer = 0;
    this._coyoteTimer = 0;
    this._jumpCutPending = true;
    this.setState(PlayerStateId.JUMP);
  }

  /** Releasing jump early shortens the arc (applied once per jump). */
  _applyJumpCut() {
    if (this._jumpCutPending && !this._jumpHeld && this.body.vy < 0) {
      this.body.vy = Math.max(
        this.body.vy,
        this._config.jumpVelocity * this._config.jumpCutMultiplier,
      );
      this._jumpCutPending = false;
    }
  }

  _refreshGrounding() {
    if (this.body.grounded) {
      this._coyoteTimer = this._config.coyoteTime;
    }
  }

  _refreshFacing() {
    if (this.moveIntent !== 0) {
      this.facing = this.moveIntent;
    }
  }
}
