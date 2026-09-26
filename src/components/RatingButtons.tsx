import { RATING_LABELS } from '../config/labels.ts';
import type { Rating } from '../domain/types.ts';

interface Props {
  intervals: Record<Rating, string>;
  disabled: boolean;
  onRate: (rating: Rating) => void;
}

const RATINGS: Rating[] = [1, 2, 3, 4];

/** Die vier Bewertungsbuttons mit Intervall-Vorschau aus ts-fsrs. */
export function RatingButtons({ intervals, disabled, onRate }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onRate(r)}
          className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-1 font-semibold active:scale-95 disabled:opacity-50 ${
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
