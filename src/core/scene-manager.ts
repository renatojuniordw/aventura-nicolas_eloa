import { Events, type EventBus } from './event-bus.js';
import type { Scene } from './scene.js';
import type { GameContext } from '../main.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';

type SceneClass = new (game: GameContext) => Scene;

/**
 * Owns the active scene and its lifecycle. Adding a scene is a registry entry,
 * never a change to the manager itself (Open/Closed Principle).
 */
export class SceneManager {
  private _game: GameContext;
  private _bus: EventBus;
  private _registry = new Map<string, SceneClass>();
  private _current: Scene | null = null;
  private _currentName: string | null = null;

  /**
   * @param game shared game context handed to every scene
   * @param bus
   */
  constructor(game: GameContext, bus: EventBus) {
    this._game = game;
    this._bus = bus;
  }

  register(name: string, SceneClass: SceneClass): void {
    this._registry.set(name, SceneClass);
  }

  get currentName(): string | null {
    return this._currentName;
  }

  get current(): Scene | null {
    return this._current;
  }

  switchTo(name: string, params: Record<string, unknown> = {}): void {
    const SceneClass = this._registry.get(name);
    if (!SceneClass) {
      throw new Error(`Scene not registered: ${name}`);
    }
    if (this._current) {
      this._current.exit();
    }
    this._current = new SceneClass(this._game);
    this._currentName = name;
    this._current.enter(params);
    this._bus.emit(Events.SCENE_CHANGED, { name });
  }

  update(dt: number): void {
    this._current?.update(dt);
  }

  draw(renderer: CanvasRenderer): void {
    this._current?.draw(renderer);
  }
}
