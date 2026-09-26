import { motion } from 'framer-motion';

interface Props {
  done: number;
  total: number;
  reached: boolean;
}

const SIZE = 200;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Tagesring: Fortschritt Richtung Tagesziel. */
export function DayRing({ done, total, reached }: Props) {
  const ratio = reached ? 1 : total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="relative size-[200px]" role="img" aria-label={`Tagesziel: ${done} von ${total}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-neutral-200 dark:stroke-neutral-800" />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          className="stroke-accent"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: CIRC * (1 - ratio) }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {reached ? (
          <>
            <span className="text-4xl font-bold text-accent">✓</span>
            <span className="mt-1 text-sm font-medium">Tagesziel erreicht</span>
          </>
        ) : (
          <>
            <span className="text-4xl font-bold">
              {done}
              <span className="text-xl text-neutral-400">/{total}</span>
            </span>
            <span className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Tagesziel</span>
          </>
        )}
      </div>
    </div>
  );
}
