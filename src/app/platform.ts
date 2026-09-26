// Kleine Helfer rund um Browser/iOS: installierte App, dauerhafter Speicher, Teilen.

/** Läuft die App als installierte App (vom Home-Bildschirm) statt im Safari-Browser? */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** Dauerhaften Speicher anfordern, damit iOS die Lerndaten nicht automatisch löscht (SPEC.md Abschnitt 9). */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return undefined;
  }
}

export interface StorageStatus {
  persisted: boolean | undefined;
  usageBytes: number | undefined;
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    const [persisted, estimate] = await Promise.all([
      navigator.storage?.persisted?.(),
      navigator.storage?.estimate?.(),
    ]);
    return { persisted, usageBytes: estimate?.usage };
  } catch {
    return { persisted: undefined, usageBytes: undefined };
  }
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Datei teilen (iOS: Teilen-Menü → „In Dateien sichern“), sonst als Download.
 * Muss direkt aus einem Tap aufgerufen werden, sonst verweigert iOS das Teilen.
 */
export async function shareOrDownload(file: File): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
