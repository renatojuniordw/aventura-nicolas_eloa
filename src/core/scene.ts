import type { GameContext } from '../main.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';

/**
 * Base class for every scene (boot, menu, game, victory).
 *
 * A scene receives the shared game context (bus, input, renderer, stores) and
 * owns its own subscriptions. The default methods are no-ops so subclasses only
 * override what they use.
 */
export class Scene {
  game: GameContext;

  constructor(game: GameContext) {
    this.game = game;
  }

  /** Called once when the scene becomes active. `params` comes from switchTo. */
  enter(_params?: Record<string, unknown>): void {}

  /** Called when leaving the scene. Subclasses should release subscriptions. */
  exit(): void {}

  /** Fixed-timestep update. */
  update(_dt: number): void {}

  /** Draw the scene. Receives the shared CanvasRenderer. */
  draw(_renderer: CanvasRenderer): void {}

  /** Optional hook for events forwarded by the SceneManager. */
  onEvent(_event: string, _payload: unknown): void {}
}
