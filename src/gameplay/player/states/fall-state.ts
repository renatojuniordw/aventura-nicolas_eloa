import { PlayerState, PlayerStateId } from '../player-state.js';

/** Airborne and descending (or having walked off a ledge). */
export class FallState extends PlayerState {
  get id() {
    return PlayerStateId.FALL;
  }

  update(_dt) {
    const player = this.player;
    player.applyAirMovement();

    if (player.body.grounded) {
      player.setState(player.moveIntent === 0 ? PlayerStateId.IDLE : PlayerStateId.WALK);
    }
  }
}
