/**
 * Every generated level file, indexed by id.
 *
 * `import.meta.glob` (Vite) bundles the JSON at build time, so levels ship with
 * the game and load synchronously — no network request, no async state in the
 * game scene. Adding a level is dropping a file in `levels/`; no code change.
 */
const modules = import.meta.glob('./levels/*.json', { eager: true, import: 'default' });

/** @type {Map<string, object>} */
export const LEVELS_BY_ID = new Map(
  Object.values(modules).map((level) => [level.id, level]),
);

export const LEVEL_COUNT = LEVELS_BY_ID.size;

/** @returns {object | null} the raw level data, or null when missing */
export function getLevelData(levelId) {
  return LEVELS_BY_ID.get(levelId) ?? null;
}
