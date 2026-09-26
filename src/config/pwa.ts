// PWA-Manifest (SPEC.md Abschnitt 10). Wird von vite.config.ts eingebunden und getestet.
// Nur Typ-Import, damit diese Datei auch ohne Vite-Laufzeit importierbar bleibt.
import type { ManifestOptions } from 'vite-plugin-pwa';
import { ACCENT_COLOR, APP_NAME, BACKGROUND_LIGHT } from './app.ts';

export const pwaManifest: Partial<ManifestOptions> = {
  name: APP_NAME,
  short_name: APP_NAME,
  description: 'Persönlicher Vokabeltrainer für die 1.500 häufigsten spanischen Wörter',
  lang: 'de',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: BACKGROUND_LIGHT,
  theme_color: ACCENT_COLOR,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/** Dateitypen, die der Service Worker vorab speichert – inklusive Wortpakete (JSON). */
export const precacheGlobPatterns = ['**/*.{js,css,html,json,png,svg,ico,webmanifest}'];
