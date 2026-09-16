/**
 * Storage contract. Any backing store (localStorage today, IndexedDB or a
 * remote profile later) only needs to implement these three methods, which
 * keeps the store logic unchanged and testable.
 */
export class StorageAdapter {
  /** @returns {string | null} */
  read(_key) {
    throw new Error('not implemented');
  }

  write(_key, _value) {
    throw new Error('not implemented');
  }

  remove(_key) {
    throw new Error('not implemented');
  }
}

/**
 * In-memory implementation used by tests and as the fallback when the browser
 * refuses persistent storage (e.g. Safari private mode).
 */
export class MemoryStorageAdapter extends StorageAdapter {
  constructor(initial = {}) {
    super();
    this._data = new Map(Object.entries(initial));
  }

  read(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }

  write(key, value) {
    this._data.set(key, String(value));
  }

  remove(key) {
    this._data.delete(key);
  }
}
