interface Props {
  onPress: () => void;
  label?: string;
}

/** Runder Audio-Button (44 × 44 px), stoppt die Weitergabe des Taps an die Karte. */
export function SpeakerButton({ onPress, label = 'Aussprache anhören' }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 active:scale-95 dark:bg-neutral-800 dark:text-neutral-100"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
      </svg>
    </button>
  );
}
