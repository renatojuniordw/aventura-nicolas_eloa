/**
 * Storage contract. Any backing store (localStorage today, IndexedDB or a
 * remote profile later) only needs to implement these three methods, which
 * keeps the store logic unchanged and testable.
 */
export class StorageAdapter {
  read(_key: string): string | null {
    throw new Error('not implemented');
  }

  write(_key: string, _value: unknown): boolean | void {
    throw new Error('not implemented');
  }

  remove(_key: string): void {
    throw new Error('not implemented');
  }
}

/**
 * In-memory implementation used by tests and as the fallback when the browser
 * refuses persistent storage (e.g. Safari private mode).
 */
export class MemoryStorageAdapter extends StorageAdapter {
  private _data: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    super();
    this._data = new Map(Object.entries(initial));
  }

  override read(key: string): string | null {
    return this._data.has(key) ? this._data.get(key)! : null;
  }

  override write(key: string, value: unknown): void {
    this._data.set(key, String(value));
  }

  override remove(key: string): void {
    this._data.delete(key);
  }
}
