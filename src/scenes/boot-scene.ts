import { Scene } from '../core/scene.js';
import { COLORS } from '../core/config.js';
import { CHARACTERS } from '../content/characters.js';

export const GAME_ASSETS = Object.freeze({
  // Backgrounds
  'bg:primavera-lago': '/assets/backgrounds/primavera-lago-pixel-v1.png',
  'bg:primavera-pomar': '/assets/backgrounds/primavera-pomar-pixel-v1.png',
  'bg:outono-bosque': '/assets/backgrounds/outono-bosque-pixel-v1.png',
  'bg:outono-vale': '/assets/backgrounds/outono-vale-pixel-v1.png',
  'bg:garden-pixel': '/assets/backgrounds/garden-pixel-v1.png',

  // Items
  'item:letter-carrier': '/assets/items/letter-carrier-pixel-v1.png',
  'item:speed': '/assets/items/speed-item-pixel-v1.png',

  // Objects
  'object:checkpoint': '/assets/objects/checkpoint-pixel-v1.png',
  'object:finish-portal': '/assets/objects/finish-portal-pixel-v1.png',

  // Terrain
  'terrain:grass-tile': '/assets/terrain/grass-tile-pixel-v1.png',
});

/**
 * First scene: kicks off character and game art preload, then hands over to the menu.
 *
 * The switch happens on the first update (not in `enter`) so the scene manager
 * is never re-entered while it is still switching. Preload is fire-and-forget:
 * gameplay never blocks on it, since `SpriteRenderer` falls back to
 * placeholder shapes until an image has actually finished loading.
 */
export class BootScene extends Scene {
  enter() {
    this._done = false;
    this._preload();
  }

  async _preload() {
    const manifest = { ...GAME_ASSETS };
    for (const character of CHARACTERS) {
      for (const [pose, src] of Object.entries(character.sprites ?? {})) {
        manifest[`${character.id}:${pose}`] = src;
      }
      if (character.portrait) manifest[`${character.id}:portrait`] = character.portrait;
    }
    try {
      await this.game.assets.load(manifest);
    } catch (error) {
      console.warn('Game art failed to preload; falling back to placeholder shapes.', error);
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
