import { MemoryStorageAdapter, StorageAdapter } from './storage-adapter.js';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * localStorage-backed adapter. Every access is wrapped because reading or
 * writing can throw (Safari private mode, quota exceeded, disabled storage) —
 * a save failure must never break the game.
 */
export class LocalStorageAdapter extends StorageAdapter {
  private _storage: StorageLike;

  constructor(storage: StorageLike) {
    super();
    this._storage = storage;
  }

  override read(key: string): string | null {
    try {
      return this._storage.getItem(key);
    } catch {
      return null;
    }
  }

  override write(key: string, value: unknown): boolean {
    try {
      this._storage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  override remove(key: string): void {
    try {
      this._storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function isLocalStorageAvailable(storage: StorageLike): boolean {
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
export function createStorageAdapter(storage?: StorageLike): StorageAdapter {
  const target = storage ?? (globalThis as { localStorage?: StorageLike }).localStorage;
  if (target && isLocalStorageAvailable(target)) {
    return new LocalStorageAdapter(target);
  }
  return new MemoryStorageAdapter();
}
