import { PlayerState, PlayerStateId } from '../player-state.js';

/** Moving along the ground in the direction of `moveIntent`. */
export class WalkState extends PlayerState {
  override get id() {
    return PlayerStateId.WALK;
  }

  override update(_dt: number): void {
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
