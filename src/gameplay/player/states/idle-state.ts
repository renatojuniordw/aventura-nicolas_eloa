import { PlayerState, PlayerStateId } from '../player-state.js';

/** Standing still on the ground. */
export class IdleState extends PlayerState {
  override get id() {
    return PlayerStateId.IDLE;
  }

  override update(_dt: number): void {
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
