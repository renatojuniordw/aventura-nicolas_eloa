/**
 * Base class for every scene (boot, menu, game, victory).
 *
 * A scene receives the shared game context (bus, input, renderer, stores) and
 * owns its own subscriptions. The default methods are no-ops so subclasses only
 * override what they use.
 */
export class Scene {
  /** @param {import('../main.js').GameContext} game */
  constructor(game) {
    this.game = game;
  }

  /** Called once when the scene becomes active. `params` comes from switchTo. */
  enter(_params) {}

  /** Called when leaving the scene. Subclasses should release subscriptions. */
  exit() {}

  /** Fixed-timestep update. */
  update(_dt) {}

  /** Draw the scene. Receives the shared CanvasRenderer. */
  draw(_renderer) {}

  /** Optional hook for events forwarded by the SceneManager. */
  onEvent(_event, _payload) {}
}
