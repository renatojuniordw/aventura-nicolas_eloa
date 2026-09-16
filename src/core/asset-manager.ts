/** Injectable image-loading strategy. Defaults to the DOM `Image` constructor. */
export type ImageLoader = (src: string) => Promise<unknown>;

/**
 * Loads and caches images by name. The loader is injected so tests (and the
 * headless server) never touch the DOM `Image` constructor.
 *
 * Usage: await assets.load({ player: playerSheetUrl }); assets.get('player')
 */
export class AssetManager {
  private _loadImage: ImageLoader;
  private _cache = new Map<string, unknown>();

  constructor(loadImage: ImageLoader = defaultLoadImage) {
    this._loadImage = loadImage;
  }

  /** @param manifest name -> source URL */
  async load(manifest: Record<string, string>): Promise<Map<string, unknown>> {
    const entries = Object.entries(manifest);
    await Promise.all(
      entries.map(async ([name, src]) => {
        const image = await this._loadImage(src);
        this._cache.set(name, image);
      }),
    );
    return this._cache;
  }

  get(name: string): unknown {
    return this._cache.get(name);
  }

  has(name: string): boolean {
    return this._cache.has(name);
  }
}

const defaultLoadImage: ImageLoader = (src) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
};
