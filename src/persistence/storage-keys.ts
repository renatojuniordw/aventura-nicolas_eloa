import { STORAGE } from '../core/config.js';

/**
 * Storage keys are versioned so a future schema can be introduced without
 * guessing what an old save contains.
 */
export const SCHEMA_VERSION = STORAGE.schemaVersion;
export const STORAGE_KEY = `${STORAGE.keyPrefix}.v${SCHEMA_VERSION}`;
/** Where unreadable/incompatible saves are kept for debugging. */
export const DEGRADED_KEY = `${STORAGE_KEY}.degraded`;

/** Device-level preference, not tied to a profile, so it lives outside SaveStore. */
export const AUDIO_SETTINGS_KEY = `${STORAGE.keyPrefix}.audio.v1`;
export const EXPERIENCE_SETTINGS_KEY = `${STORAGE.keyPrefix}.experience.v1`;
/** On-screen control layout: depends on the device and grip, not on the child's progress. */
export const TOUCH_LAYOUT_KEY = `${STORAGE.keyPrefix}.touch-layout.v1`;
/** Controls practice seen/completed: a device fact, kept apart from lessons and stars. */
export const CONTROLS_PRACTICE_KEY = `${STORAGE.keyPrefix}.controls-practice.v1`;
