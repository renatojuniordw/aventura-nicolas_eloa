import { Scene } from '../core/scene.js';
import { COLORS } from '../core/config.js';
import { DEFAULT_CHARACTER_ID, getCharacter } from '../content/characters.js';
import { WORLD_ASSETS, characterAssets } from '../render/asset-plan.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';

/**
 * First scene: kicks off the preload of the art every lesson needs (world items
 * plus the default character), then hands over to the menu. Backgrounds and the
 * other character's poses load when a lesson asks for them (see `lessonAssets`).
 *
 * The switch happens on the first update (not in `enter`) so the scene manager
 * is never re-entered while it is still switching. Preload is fire-and-forget:
 * gameplay never blocks on it, since `SpriteRenderer` falls back to
 * placeholder shapes until an image has actually finished loading.
 */
export class BootScene extends Scene {
  private _done = false;

  override enter(): void {
    this._done = false;
    this._preload();
  }

  private async _preload(): Promise<void> {
    const manifest = { ...WORLD_ASSETS, ...characterAssets(getCharacter(DEFAULT_CHARACTER_ID)) };
    try {
      await this.game.assets.load(manifest);
    } catch (error) {
      console.warn('Game art failed to preload; falling back to placeholder shapes.', error);
    }
  }

  override update(): void {
    if (this._done) return;
    this._done = true;
    this.game.scenes.switchTo('menu');
  }

  override draw(renderer: CanvasRenderer): void {
    renderer.clear(COLORS.sky);
  }
}
