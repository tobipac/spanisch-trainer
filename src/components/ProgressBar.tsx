interface Props {
  done: number;
  total: number;
}

export function ProgressBar({ done, total }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} von ${total} Karten`}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
    </div>
  );
}
