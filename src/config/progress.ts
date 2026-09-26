// Konstanten für den Fortschritt-Screen (SPEC.md Abschnitt 5 und 7).

/** Fortschrittsbänder nach Rang (einschließlich). */
export const BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 100],
  [101, 250],
  [251, 500],
  [501, 1000],
  [1001, 1500],
];

/** Abzeichen, sobald dieser Anteil eines Bands gefestigt ist. */
export const BADGE_THRESHOLD = 0.9;

/** Verlauf: so viele Lerntage rückwirkend (inklusive heute). */
export const HISTORY_DAYS = 30;

/** Vorschau: so viele Lerntage ab heute. */
export const FORECAST_DAYS = 7;
