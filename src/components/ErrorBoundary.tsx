import { Component, type ReactNode } from 'react';
import { logError } from '../app/errorLog.ts';

interface State {
  failed: boolean;
}

/** Fängt Darstellungsfehler ab: statt weißer Seite ein Hinweis mit „Neu laden“. Lerndaten bleiben gespeichert. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    logError(error, 'Darstellung');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Da ist etwas schiefgelaufen</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Deine Lerndaten sind gespeichert. Lade die App neu. Der Fehler steht im Fehlerprotokoll (Einstellungen → Info).
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-14 w-full max-w-xs rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95"
        >
          Neu laden
        </button>
      </div>
    );
  }
}
