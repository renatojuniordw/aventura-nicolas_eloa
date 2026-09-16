import { PlayerState, PlayerStateId } from '../player-state.js';

/**
 * Rising after a jump. Hands over to FALL at the apex (vy >= 0).
 * Air control is allowed here, which is also where a future double jump would
 * hook in (a new state, not a change to the controller's API).
 */
export class JumpState extends PlayerState {
  override get id() {
    return PlayerStateId.JUMP;
  }

  override update(_dt: number): void {
    const player = this.player;
    player.applyAirMovement();

    if (player.body.vy >= 0) {
      player.setState(PlayerStateId.FALL);
    }
  }
}
