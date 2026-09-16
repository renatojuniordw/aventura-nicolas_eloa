import { MemoryStorageAdapter, StorageAdapter } from './storage-adapter.js';

/**
 * localStorage-backed adapter. Every access is wrapped because reading or
 * writing can throw (Safari private mode, quota exceeded, disabled storage) —
 * a save failure must never break the game.
 */
export class LocalStorageAdapter extends StorageAdapter {
  constructor(storage) {
    super();
    this._storage = storage;
  }

  read(key) {
    try {
      return this._storage.getItem(key);
    } catch {
      return null;
    }
  }

  write(key, value) {
    try {
      this._storage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key) {
    try {
      this._storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function isLocalStorageAvailable(storage) {
  try {
    const probe = '__joguinho_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick the best available backing store, falling back to memory so the game
 * still runs (without persistence) when storage is blocked.
 */
export function createStorageAdapter(storage = globalThis.localStorage) {
  if (storage && isLocalStorageAvailable(storage)) {
    return new LocalStorageAdapter(storage);
  }
  return new MemoryStorageAdapter();
}
