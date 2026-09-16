import { defineConfig } from 'vitest/config';

// Unit tests target pure logic only (physics, input mapping, validation,
// persistence). No jsdom: DOM-facing modules receive injected collaborators.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts,tsx}', 'tools/**/*.test.mjs'],
    globals: false,
  },
});
