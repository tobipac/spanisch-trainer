import { useEffect, useState } from 'react';
import { APP_NAME } from '../config/app.ts';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** App-Shell (E0): Platzhalter, bis die Screens in späteren Etappen folgen. */
export function App() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="flex h-full flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <header className="py-4">
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Vokabeltrainer · Grundgerüst (E0)</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="size-40 rounded-full border-[12px] border-accent" aria-hidden="true" />
        <ul className="space-y-1 text-base">
          <li>Modus: {isStandalone() ? 'installierte App' : 'Browser'}</li>
          <li>Verbindung: {online ? 'online' : 'offline'}</li>
        </ul>
      </main>

      <button
        type="button"
        disabled
        className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white opacity-50"
      >
        Lernen starten
      </button>
    </div>
  );
}
