import { migrate, type SaveDocument } from './migration.js';
import { DEGRADED_KEY, STORAGE_KEY } from './storage-keys.js';
import type { StorageAdapter } from './storage-adapter.js';

interface SaveStoreOptions {
  adapter: StorageAdapter;
  key?: string;
  degradedKey?: string;
  now?: () => number;
}

/**
 * Low-level access to the single versioned save document.
 *
 * Responsibilities: read + migrate + normalise, keep a backup of anything
 * unreadable, and write the document back. It knows nothing about profiles or
 * progress — that is the stores' job.
 */
export class SaveStore {
  /** Why the last read recovered a fresh document, if it did. */
  lastRecoveryReason: string | null = null;

  private _adapter: StorageAdapter;
  private _key: string;
  private _degradedKey: string;
  private _now: () => number;

  constructor({ adapter, key = STORAGE_KEY, degradedKey = DEGRADED_KEY, now = () => Date.now() }: SaveStoreOptions) {
    if (!adapter) throw new TypeError('SaveStore requires a storage adapter');
    this._adapter = adapter;
    this._key = key;
    this._degradedKey = degradedKey;
    this._now = now;
  }

  read(): SaveDocument {
    const raw = this._adapter.read(this._key);
    const { doc, migrated, reason } = migrate(raw);

    this.lastRecoveryReason = reason;
    if (reason) {
      // Keep the unreadable payload for diagnostics instead of discarding it.
      this._adapter.write(this._degradedKey, typeof raw === 'string' ? raw : JSON.stringify(raw));
    }
    if (migrated) {
      this.write(doc);
    }
    return doc;
  }

  write(doc: SaveDocument): boolean | void {
    const payload = { ...doc, updatedAt: this._now() };
    const ok = this._adapter.write(this._key, JSON.stringify(payload));
    doc.updatedAt = payload.updatedAt;
    return ok;
  }

  /** Read, mutate and persist in one step. @param mutator may return a value to pass through */
  update<T>(mutator: (doc: SaveDocument) => T): T {
    const doc = this.read();
    const result = mutator(doc);
    this.write(doc);
    return result;
  }

  clear(): void {
    this._adapter.remove(this._key);
    this._adapter.remove(this._degradedKey);
  }
}
