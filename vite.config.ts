/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { precacheGlobPatterns, pwaManifest } from './src/config/pwa.ts';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': Kein automatisches Neuladen mitten in einer Session (SPEC.md Abschnitt 10).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.svg'],
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
