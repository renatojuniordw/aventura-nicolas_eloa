import { defineConfig } from 'vite';

// Vite handles ES modules, JSON imports and asset hashing with zero config.
// Kept explicit so the build's public path and server port are documented.
export default defineConfig({
  server: {
    port: 65000,
    open: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
