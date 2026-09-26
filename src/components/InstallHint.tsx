/** Dauerhafter Hinweis, wenn die App im Safari-Browser statt vom Home-Bildschirm geöffnet wird (SPEC.md Abschnitt 5). */
export function InstallHint() {
  return (
    <div className="mb-3 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm" role="note">
      <p className="font-semibold">Als App installieren</p>
      <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">
        Tippe unten in Safari auf <ShareIcon /> <strong>Teilen</strong> und dann auf{' '}
        <strong>„Zum Home-Bildschirm“</strong>. Nur so funktioniert die App offline und deine Lerndaten sind sicher
        gespeichert.
      </p>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline size-4 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  );
}
