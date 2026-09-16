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

/**
 * Base class. States drive horizontal intent and decide transitions; the
 * controller owns the body, physics and the timers.
 */
export class PlayerState {
  /** @param {import('./player-controller.js').PlayerController} player */
  constructor(player) {
    this.player = player;
  }

  /** @returns {string} */
  get id() {
    return 'base';
  }

  /** Called when the state becomes active. */
  enter() {}

  /** Called when leaving the state. */
  exit() {}

  /** @param {number} _dt */
  update(_dt) {}
}
