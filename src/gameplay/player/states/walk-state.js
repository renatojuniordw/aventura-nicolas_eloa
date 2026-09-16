import { PlayerState, PlayerStateId } from '../player-state.js';

/** Moving along the ground in the direction of `moveIntent`. */
export class WalkState extends PlayerState {
  get id() {
    return PlayerStateId.WALK;
  }

  update(_dt) {
    const player = this.player;
    player.applyGroundMovement();

    if (!player.body.grounded) {
      player.setState(PlayerStateId.FALL);
      return;
    }
    if (player.moveIntent === 0) {
      player.setState(PlayerStateId.IDLE);
    }
  }
}
