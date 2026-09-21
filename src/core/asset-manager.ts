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
  private _pending = new Map<string, Promise<void>>();

  constructor(loadImage: ImageLoader = defaultLoadImage) {
    this._loadImage = loadImage;
  }

  /**
   * Loads whatever `manifest` names that is not cached yet; safe to call again
   * for the same names (in flight or done) — lessons request their art on demand.
   *
   * @param manifest name -> source URL
   */
  async load(manifest: Record<string, string>): Promise<Map<string, unknown>> {
    const entries = Object.entries(manifest).filter(([name]) => !this._cache.has(name));
    await Promise.all(entries.map(([name, src]) => this._loadOnce(name, src)));
    return this._cache;
  }

  private _loadOnce(name: string, src: string): Promise<void> {
    const inFlight = this._pending.get(name);
    if (inFlight) return inFlight;
    const request = this._loadImage(src)
      .then((image) => {
        this._cache.set(name, image);
      })
      .finally(() => this._pending.delete(name));
    this._pending.set(name, request);
    return request;
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
