import { motion } from 'framer-motion';

interface Props {
  cards: number;
  xp: number;
  streak: number;
  goalReached: boolean;
  onClose: () => void;
}

/** Zusammenfassung am Session-Ende. */
export function SessionSummary({ cards, xp, streak, goalReached, onClose }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className="flex size-28 items-center justify-center rounded-full bg-accent text-white"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="size-14" fill="none" stroke="currentColor" strokeWidth="3">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.28, delay: 0.1 }}
          />
        </svg>
      </motion.div>
      <div>
        <h2 className="text-2xl font-bold">{goalReached ? 'Tagesziel erreicht!' : 'Für jetzt geschafft'}</h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          {goalReached ? 'Alles für heute erledigt.' : 'Nichts mehr fällig. Später kommen noch Lernschritte.'}
        </p>
      </div>
      <dl className="grid w-full max-w-xs grid-cols-3 gap-3">
        <div className="rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
          <dt className="text-sm text-neutral-500 dark:text-neutral-400">Karten</dt>
          <dd className="text-3xl font-bold">{cards}</dd>
        </div>
        <div className="rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
          <dt className="text-sm text-neutral-500 dark:text-neutral-400">XP</dt>
          <dd className="text-3xl font-bold">+{xp}</dd>
        </div>
        <div className="rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
          <dt className="text-sm text-neutral-500 dark:text-neutral-400">Streak</dt>
          <dd className="text-3xl font-bold">{streak}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onClose}
        className="min-h-14 w-full max-w-xs rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95"
      >
        Fertig
      </button>
    </div>
  );
}
