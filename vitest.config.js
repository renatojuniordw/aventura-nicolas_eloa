import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests target pure logic only (physics, input mapping, validation,
// persistence). No jsdom: DOM-facing modules receive injected collaborators.
export default defineConfig({
  resolve: {
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./tools/test-stubs/pwa-register.js', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts,tsx}', 'tools/**/*.test.mjs'],
    globals: false,
  },
});
