import { migrate } from './migration.js';
import { DEGRADED_KEY, STORAGE_KEY } from './storage-keys.js';

/**
 * Low-level access to the single versioned save document.
 *
 * Responsibilities: read + migrate + normalise, keep a backup of anything
 * unreadable, and write the document back. It knows nothing about profiles or
 * progress — that is the stores' job.
 */
export class SaveStore {
  constructor({ adapter, key = STORAGE_KEY, degradedKey = DEGRADED_KEY, now = () => Date.now() }) {
    if (!adapter) throw new TypeError('SaveStore requires a storage adapter');
    this._adapter = adapter;
    this._key = key;
    this._degradedKey = degradedKey;
    this._now = now;
    /** Why the last read recovered a fresh document, if it did. */
    this.lastRecoveryReason = null;
  }

  read() {
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

  write(doc) {
    const payload = { ...doc, updatedAt: this._now() };
    const ok = this._adapter.write(this._key, JSON.stringify(payload));
    doc.updatedAt = payload.updatedAt;
    return ok;
  }

  /**
   * Read, mutate and persist in one step.
   * @param {(doc: object) => any} mutator may return a value to pass through
   */
  update(mutator) {
    const doc = this.read();
    const result = mutator(doc);
    this.write(doc);
    return result;
  }

  clear() {
    this._adapter.remove(this._key);
    this._adapter.remove(this._degradedKey);
  }
}
