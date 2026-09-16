import type { PlayerController } from './player-controller.js';

/**
 * States of the player state machine (State pattern).
 *
 * The set is deliberately small for v1; a future double jump becomes a new
 * entry + one small class, without touching the controller's public API. That
 * is the extension point the architecture promises.
 */
export const PlayerStateId = Object.freeze({
  IDLE: 'idle',
  WALK: 'walk',
  JUMP: 'jump',
  FALL: 'fall',
});

export type PlayerStateIdValue = (typeof PlayerStateId)[keyof typeof PlayerStateId];

/**
 * Base class. States drive horizontal intent and decide transitions; the
 * controller owns the body, physics and the timers.
 */
export class PlayerState {
  player: PlayerController;

  constructor(player: PlayerController) {
    this.player = player;
  }

  get id(): PlayerStateIdValue | 'base' {
    return 'base';
  }

  /** Called when the state becomes active. */
  enter(): void {}

  /** Called when leaving the state. */
  exit(): void {}

  update(_dt: number): void {}
}
