import { PlayerState, PlayerStateId } from '../player-state.js';

/** Airborne and descending (or having walked off a ledge). */
export class FallState extends PlayerState {
  override get id() {
    return PlayerStateId.FALL;
  }

  override update(_dt: number): void {
    const player = this.player;
    player.applyAirMovement();

    if (player.body.grounded) {
      player.setState(player.moveIntent === 0 ? PlayerStateId.IDLE : PlayerStateId.WALK);
    }
  }
}
