import { STORAGE } from '../core/config.js';

/**
 * Storage keys are versioned so a future schema can be introduced without
 * guessing what an old save contains.
 */
export const SCHEMA_VERSION = STORAGE.schemaVersion;
export const STORAGE_KEY = `${STORAGE.keyPrefix}.v${SCHEMA_VERSION}`;
/** Where unreadable/incompatible saves are kept for debugging. */
export const DEGRADED_KEY = `${STORAGE_KEY}.degraded`;
