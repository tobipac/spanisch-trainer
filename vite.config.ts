/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { precacheGlobPatterns, pwaManifest } from './src/config/pwa.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': Kein automatisches Neuladen mitten in einer Session (SPEC.md Abschnitt 10).
      registerType: 'prompt',
      injectRegister: false,
      // Icons, Favicon und Manifest erfasst bereits globPatterns – nicht doppelt vorab speichern.
      includeManifestIcons: false,
      manifest: pwaManifest,
      workbox: {
        globPatterns: precacheGlobPatterns,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // Die Wortpakete sind bewusst im Haupt-Bundle (offline sofort verfügbar); daher höhere Warnschwelle.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
