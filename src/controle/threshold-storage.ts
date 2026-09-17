import { DEFAULT_JUMP_DETECTOR_THRESHOLDS, type JumpDetectorThresholds } from './jump-detector.js';

const STORAGE_KEY = 'joguinho.controle.thresholds.v1';
const KEYS = Object.keys(DEFAULT_JUMP_DETECTOR_THRESHOLDS) as Array<keyof JumpDetectorThresholds>;

/**
 * Persists thresholds tuned via the `?debug=1` panel (docs/12 §10) across
 * sessions — without this, a parent had to redo the same fine-tuning every
 * single time the page reloaded. Applies regardless of `?debug=1`: the flag
 * only controls whether the panel itself is shown, not whether a previous
 * tuning takes effect.
 *
 * `storage` is injectable (defaults to `window.localStorage`) so this stays
 * testable without a browser, matching `persistence/local-storage-adapter.ts`.
 */
export function loadThresholds(storage: Storage = window.localStorage): JumpDetectorThresholds {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_JUMP_DETECTOR_THRESHOLDS };
    const parsed = JSON.parse(raw);
    const result = { ...DEFAULT_JUMP_DETECTOR_THRESHOLDS };
    for (const key of KEYS) {
      if (typeof parsed[key] === 'number' && Number.isFinite(parsed[key])) {
        result[key] = parsed[key];
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_JUMP_DETECTOR_THRESHOLDS };
  }
}

export function saveThresholds(thresholds: JumpDetectorThresholds, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // Private browsing / storage full / disabled — tuning just won't persist.
  }
}
