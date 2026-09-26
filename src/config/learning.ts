// Konstanten der Lernlogik (SPEC.md Abschnitt 4 und 7). Nur hier ändern.
import type { StepUnit } from 'ts-fsrs';

/** FSRS-Parameter (ts-fsrs). Standardgewichte, keine eigene Optimierung in V1. */
export const FSRS_PARAMS = {
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'] as StepUnit[],
  // SPEC nennt nur Lernschritte; für Wiederlernen bleibt der ts-fsrs-Standard (10 min).
  relearning_steps: ['10m'] as StepUnit[],
};

/** Der Lerntag wechselt um 04:00 Uhr lokaler Zeit. */
export const DAY_START_HOUR = 4;

/** Neue Wörter pro Tag: Einstellung 5–20, Standard 12. */
export const NEW_PER_DAY_MIN = 5;
export const NEW_PER_DAY_MAX = 20;
export const NEW_PER_DAY_DEFAULT = 12;

/** Drosselung: mehr als HALF fällige Karten → Limit halbieren, mehr als ZERO → 0. */
export const THROTTLE_HALF_ABOVE = 100;
export const THROTTLE_ZERO_ABOVE = 150;

/** Nach je so vielen Wiederholungen wird 1 neue Karte eingestreut. */
export const REVIEWS_PER_NEW_CARD = 4;

/** Umkehrkarte kommt in die Warteschlange ab diesem Intervall (Tage) der Spanisch → Deutsch-Karte. */
export const REVERSE_MIN_INTERVAL_DAYS = 3;

/** Hinweis auf dem Heute-Screen, wenn die Warteschlange größer ist als Faktor × Tageslimit. */
export const REVERSE_QUEUE_HINT_FACTOR = 2;

/**
 * Annahme: Lernschritt-Karten, die in höchstens so vielen Minuten fällig werden, dürfen vorgezogen
 * werden, wenn sonst nichts mehr zu tun ist (sonst müsste man auf den 10-min-Schritt warten).
 */
export const LEARN_AHEAD_MINUTES = 20;

/** „Gefestigt“ = FSRS-stability der Spanisch → Deutsch-Karte ab so vielen Tagen. */
export const STABLE_MIN_STABILITY_DAYS = 21;

/** Annahme für die Zeitschätzung auf dem Heute-Screen. */
export const SECONDS_PER_CARD = 8;

/** XP (SPEC.md Abschnitt 7). Einführung einer Umkehrkarte zählt als Wiederholung. */
export const XP_PER_REVIEW = 1;
export const XP_PER_NEW_WORD = 2;
export const XP_GOAL_BONUS = 10;

/** Level n ab 50 · n² XP; unter 50 XP Level 0. */
export const LEVEL_XP_FACTOR = 50;
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / LEVEL_XP_FACTOR));
}

/** Standardeinstellungen beim ersten Start. */
export const DEFAULT_SPEECH_RATE = 0.9;
export const SPEECH_RATE_MIN = 0.7;
export const SPEECH_RATE_MAX = 1.1;
