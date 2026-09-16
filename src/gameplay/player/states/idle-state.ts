import { PlayerState, PlayerStateId } from '../player-state.js';

/** Standing still on the ground. */
export class IdleState extends PlayerState {
  get id() {
    return PlayerStateId.IDLE;
  }

  update(_dt) {
    const player = this.player;
    player.applyGroundMovement();

    if (!player.body.grounded) {
      player.setState(PlayerStateId.FALL);
      return;
    }
    if (player.moveIntent !== 0) {
      player.setState(PlayerStateId.WALK);
    }
  }
}
