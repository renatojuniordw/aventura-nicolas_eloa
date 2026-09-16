import { Scene } from '../core/scene.js';
import { COLORS } from '../core/config.js';
import { CHARACTERS } from '../content/characters.js';

/**
 * First scene: kicks off character art preload, then hands over to the menu.
 *
 * The switch happens on the first update (not in `enter`) so the scene manager
 * is never re-entered while it is still switching. Preload is fire-and-forget:
 * gameplay never blocks on it, since `SpriteRenderer` falls back to a
 * placeholder shape until an image has actually finished loading.
 */
export class BootScene extends Scene {
  enter() {
    this._done = false;
    this._preload();
  }

  async _preload() {
    const manifest = {};
    for (const character of CHARACTERS) {
      for (const [pose, src] of Object.entries(character.sprites ?? {})) {
        manifest[`${character.id}:${pose}`] = src;
      }
      if (character.portrait) manifest[`${character.id}:portrait`] = character.portrait;
    }
    try {
      await this.game.assets.load(manifest);
    } catch (error) {
      console.warn('Character art failed to preload; falling back to placeholder shapes.', error);
    }
  }

  update() {
    if (this._done) return;
    this._done = true;
    this.game.scenes.switchTo('menu');
  }

  draw(renderer) {
    renderer.clear(COLORS.sky);
  }
}
