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
      // 'prompt' keeps a new service worker waiting until ui/pwa-update.ts decides
      // it is safe to activate it (never mid-level); 'autoUpdate' would swap it
      // in immediately and leave the open page running stale code.
      registerType: 'prompt',
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
        // vite-plugin-pwa's default SPA navigation fallback serves index.html
        // for every navigation the active service worker intercepts — including
        // /controle. Without this denylist, once the SW takes control on a
        // phone's second visit, scanning the QR code again loads the game menu
        // instead of the control page (index.html), no matter the URL.
        navigateFallbackDenylist: [/^\/controle/],
        // The app shell (code, styles, the ~150 level JSONs — inlined into
        // the JS bundle by content/level-registry.ts) and all the pixel art
        // (~1.5MB of WebP under /assets/) precache on install, so the whole
        // game works offline after the first visit. Vite's own JS/CSS chunks
        // and the copied public/assets art both land under dist/assets/.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      },
    }),
  ],
});
