// Vitest stand-in for vite-plugin-pwa's `virtual:pwa-register` module, which
// only exists inside a real Vite build.
export function registerSW() {
  return async () => {};
}
