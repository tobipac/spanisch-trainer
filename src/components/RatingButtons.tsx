import { useEffect, useState } from 'react';
import { EASY_LOCKED_HINT, RATING_LABELS } from '../config/labels.ts';
import type { Rating } from '../domain/types.ts';

interface Props {
  intervals: Record<Rating, string>;
  disabled: boolean;
  /** Bewertungen, die für diese Karte gesperrt sind (ausgegraut, Hinweis beim Antippen) */
  locked?: Rating[];
  onRate: (rating: Rating) => void;
}

const RATINGS: Rating[] = [1, 2, 3, 4];

/** Die vier Bewertungsbuttons mit Intervall-Vorschau aus ts-fsrs. */
export function RatingButtons({ intervals, disabled, locked = [], onRate }: Props) {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 2500);
    return () => clearTimeout(t);
  }, [hint]);

  return (
    <div className="relative grid grid-cols-4 gap-2">
      {hint && (
        <p role="status" className="absolute inset-x-0 -top-12 rounded-xl bg-neutral-900 px-3 py-2 text-center text-sm text-white dark:bg-neutral-100 dark:text-neutral-900">
          {EASY_LOCKED_HINT}
        </p>
      )}
      {RATINGS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          aria-disabled={locked.includes(r)}
          onClick={() => (locked.includes(r) ? setHint(true) : onRate(r))}
          className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-1 font-semibold active:scale-95 disabled:opacity-50 ${
            locked.includes(r) ? 'opacity-35' : ''
          } ${
            r === 3
              ? 'bg-accent text-white'
              : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
          }`}
        >
          <span className="text-base">{RATING_LABELS[r]}</span>
          <span className={`text-xs font-normal ${r === 3 ? 'text-white/85' : 'text-neutral-500 dark:text-neutral-400'}`}>
            {intervals[r]}
          </span>
        </button>
      ))}
    </div>
  );
}
