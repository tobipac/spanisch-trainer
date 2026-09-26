// Service Worker und Update-Hinweis (SPEC.md Abschnitt 10):
// Eine neue Version wird nie automatisch aktiviert – die App zeigt „Update verfügbar – neu laden“,
// außer während einer Lern-Session.
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let updateAvailable = false;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export function initServiceWorker(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable = true;
      listeners.forEach((l) => l());
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Beim Zurückkehren in die App nach einer neuen Version suchen (installierte Apps laufen oft tagelang).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
      });
    },
  });
}

/** Neue Version aktivieren und die Seite neu laden. */
export function applyUpdate(): void {
  void updateSW?.(true);
  // Rückfall: Wenn die Seite (noch) nicht vom Service Worker gesteuert wird, kommt kein „controlling“-Signal
  // und damit kein automatisches Neuladen – dann selbst neu laden.
  setTimeout(() => window.location.reload(), 1500);
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => updateAvailable,
  );
}
