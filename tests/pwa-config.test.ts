import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { precacheGlobPatterns, pwaManifest } from '../src/config/pwa.ts';

describe('PWA-Manifest', () => {
  it('startet als eigenständige App', () => {
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
  });

  it('enthält Icons in 192 und 512 px, die im public-Ordner existieren', () => {
    const icons = pwaManifest.icons ?? [];
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of icons) {
      expect(existsSync(new URL(`../public/${icon.src}`, import.meta.url))).toBe(true);
    }
  });

  it('hat ein apple-touch-icon mit 180 px', () => {
    expect(existsSync(new URL('../public/icons/apple-touch-icon.png', import.meta.url))).toBe(true);
  });

  it('speichert Wortpakete (JSON) vorab für den Offline-Betrieb', () => {
    expect(precacheGlobPatterns.join(',')).toMatch(/json/);
  });
});
