/**
 * Node ESM resolution hook: when a relative `.js` specifier fails to resolve
 * (because the source file was converted to TypeScript), retry as `.ts`.
 *
 * The whole codebase deliberately keeps `.js` extensions in imports even
 * after files become `.ts` — Vite/Vitest and TypeScript's `bundler` module
 * resolution both do this substitution automatically, so no import path in
 * `src/` had to change during the TS migration. Plain `node` has no such
 * substitution, so standalone scripts under `tools/` that import from `src/`
 * (e.g. `generate-levels.mts`) need this hook instead of forcing every
 * cross-package import in the app to spell out `.ts`.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.endsWith('.js')) {
      try {
        return await nextResolve(`${specifier.slice(0, -3)}.ts`, context);
      } catch {
        // Fall through to the original error below.
      }
    }
    throw error;
  }
}
