export type Tab = 'home' | 'progress' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'home', label: 'Heute', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { id: 'progress', label: 'Fortschritt', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  {
    id: 'settings',
    label: 'Einstellungen',
    icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  },
];

/** Untere Navigation. */
export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="grid grid-cols-3 border-t border-neutral-200 pt-1 dark:border-neutral-800" aria-label="Hauptnavigation">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs ${
            active === t.id ? 'text-accent-ink' : 'text-neutral-500'
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
