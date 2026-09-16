/**
 * Loads and caches images by name. The loader is injected so tests (and the
 * headless server) never touch the DOM `Image` constructor.
 *
 * Usage: await assets.load({ player: playerSheetUrl }); assets.get('player')
 */
export class AssetManager {
  /**
   * @param {(src: string) => Promise<unknown>} [loadImage] injectable loader
   */
  constructor(loadImage = defaultLoadImage) {
    this._loadImage = loadImage;
    /** @type {Map<string, unknown>} */
    this._cache = new Map();
  }

  /**
   * @param {Record<string, string>} manifest name -> source URL
   * @returns {Promise<Map<string, unknown>>}
   */
  async load(manifest) {
    const entries = Object.entries(manifest);
    await Promise.all(
      entries.map(async ([name, src]) => {
        const image = await this._loadImage(src);
        this._cache.set(name, image);
      }),
    );
    return this._cache;
  }

  get(name) {
    return this._cache.get(name);
  }

  has(name) {
    return this._cache.has(name);
  }
}

function defaultLoadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}
