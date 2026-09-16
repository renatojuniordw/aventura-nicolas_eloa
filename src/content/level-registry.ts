/**
 * Every generated level file, indexed by id.
 *
 * `import.meta.glob` (Vite) bundles the JSON at build time, so levels ship with
 * the game and load synchronously — no network request, no async state in the
 * game scene. Adding a level is dropping a file in `levels/`; no code change.
 */
const modules = import.meta.glob('./levels/*.json', { eager: true, import: 'default' }) as Record<
  string,
  { id: string; [key: string]: unknown }
>;

export const LEVELS_BY_ID: Map<string, { id: string; [key: string]: unknown }> = new Map(
  Object.values(modules).map((level) => [level.id, level]),
);

export const LEVEL_COUNT = LEVELS_BY_ID.size;

/** @returns the raw level data, or null when missing */
export function getLevelData(levelId: string | undefined): { id: string; [key: string]: unknown } | null {
  return (levelId ? LEVELS_BY_ID.get(levelId) : undefined) ?? null;
}
