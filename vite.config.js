import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = fileURLToPath(new URL('.', import.meta.url));

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
    // No sourcemaps in production: `true` shipped the full original sources
    // (plus absolute local paths) alongside the bundle. Keep debugging local.
    sourcemap: false,
    rollupOptions: {
      // /controle (docs/12-controle-por-celular.md §5) is a separate, much
      // lighter entry point — a second `<html>` input keeps it out of the
      // main game bundle instead of code-splitting it out of index.html.
      input: {
        main: `${root}index.html`,
        controle: `${root}controle.html`,
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Aventura do Nicolas&Eloá',
        short_name: 'Nicolas&Eloá',
        description:
          'Jogo de plataforma 2D educativo em português: pule, descubra e brinque com letras, sílabas e palavras.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        // Gameplay is a fixed 16:9 canvas (see core/config.js VIEWPORT);
        // landscape matches the "gire o celular" guard in touch-controls.css.
        orientation: 'landscape',
        background_color: '#141c24',
        theme_color: '#141c24',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // The app shell (code, styles, the ~150 level JSONs — inlined into
        // the JS bundle by content/level-registry.js) precaches on install.
        // Pixel-art backgrounds/characters/portraits under /assets/ are 22MB
        // total: too much to force on every install, so those cache on
        // demand instead (CacheFirst below), the first time a level actually
        // uses them. Both together mean the whole game works offline after
        // one normal play session, without a heavy first install.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Vite's own JS/CSS chunks and the copied public/assets pixel art
        // both land under dist/assets/ — these globIgnores are what keeps
        // the 22MB of art out of the precache (see runtimeCaching below)
        // while still precaching the bundle itself.
        globIgnores: [
          'assets/backgrounds/**',
          'assets/characters/**',
          'assets/items/**',
          'assets/objects/**',
          'assets/portraits/**',
          'assets/terrain/**',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-assets',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
