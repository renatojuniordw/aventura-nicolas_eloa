import { Events } from './event-bus.js';

/**
 * Owns the active scene and its lifecycle. Adding a scene is a registry entry,
 * never a change to the manager itself (Open/Closed Principle).
 */
export class SceneManager {
  /**
   * @param {object} game shared game context handed to every scene
   * @param {import('./event-bus.js').EventBus} bus
   */
  constructor(game, bus) {
    this._game = game;
    this._bus = bus;
    /** @type {Map<string, new (game: object) => import('./scene.js').Scene>} */
    this._registry = new Map();
    /** @type {import('./scene.js').Scene | null} */
    this._current = null;
    this._currentName = null;
  }

  /** @param {string} name @param {new (game: object) => object} SceneClass */
  register(name, SceneClass) {
    this._registry.set(name, SceneClass);
  }

  get currentName() {
    return this._currentName;
  }

  get current() {
    return this._current;
  }

  switchTo(name, params = {}) {
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

  update(dt) {
    this._current?.update(dt);
  }

  draw(renderer) {
    this._current?.draw(renderer);
  }
}
