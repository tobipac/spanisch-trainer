/** Kleines Symbol für Problemkarten (≥ 8 × „Nochmal“). Kein Hinweistext, nur Beschriftung für VoiceOver. */
export function ProblemIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 shrink-0 text-accent-ink ${className}`}
      fill="currentColor"
      role="img"
      aria-label="Problemkarte"
    >
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
