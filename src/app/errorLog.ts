// Kleines Fehlerprotokoll im Gerät (localStorage), damit Fehler aus dem Alltagstest nachvollziehbar sind.
// Einsehen, kopieren und leeren: Einstellungen → Info → Fehlerprotokoll.

const KEY = 'spanisch-trainer:errors';
const MAX_ENTRIES = 30;

export interface ErrorEntry {
  at: string; // ISO-Zeitpunkt
  message: string;
  stack?: string;
  version: string;
}

export function readErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function logError(error: unknown, context?: string): void {
  const e = error instanceof Error ? error : new Error(String(error));
  const entry: ErrorEntry = {
    at: new Date().toISOString(),
    message: context ? `${context}: ${e.message}` : e.message,
    stack: e.stack?.split('\n').slice(0, 6).join('\n'),
    version: __APP_VERSION__,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...readErrors()].slice(0, MAX_ENTRIES)));
  } catch {
    // Speicher voll oder gesperrt: Protokoll ist nur eine Hilfe, die App läuft weiter.
  }
  console.error(entry.message, e);
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorieren
  }
}

/** Unbehandelte Fehler und abgelehnte Promises global protokollieren. */
export function installGlobalErrorLogging(): void {
  window.addEventListener('error', (ev) => logError(ev.error ?? ev.message, 'Fehler'));
  window.addEventListener('unhandledrejection', (ev) => logError(ev.reason, 'Unbehandelt'));
}
