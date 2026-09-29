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
 * Eine Lernschritt-Karte erscheint erst, wenn sie fällig ist und seit ihrer letzten Ansicht mindestens
 * so viele andere Karten gezeigt wurden (kein Bewerten aus dem Kurzzeitgedächtnis). Nie im Voraus.
 */
export const LEARNING_MIN_CARDS_BETWEEN = 4;

/**
 * Annahme: Liegt die letzte Ansicht mindestens so viele Minuten zurück, entfällt der Kartenabstand –
 * sonst bliebe eine einzelne Lernkarte ohne andere Karten dauerhaft gesperrt.
 */
export const LEARNING_GAP_FALLBACK_MINUTES = 10;

/** „Gefestigt“ = FSRS-stability der Spanisch → Deutsch-Karte ab so vielen Tagen. */
export const STABLE_MIN_STABILITY_DAYS = 21;

/**
 * Zeitschätzung auf dem Heute-Screen.
 * Annahme: Eine Kartenansicht dauert ca. 8 s. Neue Karten durchlaufen die Lernschritte und
 * erscheinen dabei im Schnitt ca. 3,5-mal (erste Ansicht, 1-min- und 10-min-Schritt, gelegentliches
 * „Nochmal“); eine Wiederholung erscheint einmal. Neue Umkehrkarten zählen wie neue Karten,
 * weil sie ebenfalls die Lernschritte durchlaufen.
 */
export const SECONDS_PER_VIEW = 8;
export const VIEWS_PER_NEW_CARD = 3.5;
export const VIEWS_PER_REVIEW = 1;

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

/** Backup-Hinweis auf dem Heute-Screen, wenn das letzte Backup älter ist als so viele Tage. */
export const BACKUP_REMINDER_DAYS = 7;

/** Problemkarte: so viele „Nochmal“ insgesamt (alle Bewertungen dieser Karte). */
export const PROBLEM_CARD_AGAIN_MIN = 8;

/** Schwaches Wort: mindestens so viele „Nochmal“ (beide Richtungen zusammen) … */
export const WEAK_WORD_AGAIN_MIN = 3;
/** … innerhalb so vieler Tage. */
export const WEAK_WORD_WINDOW_DAYS = 30;

/** Extra-Übung „Schwache Wörter“: höchstens so viele Wörter je Runde. */
export const PRACTICE_MAX_WORDS = 10;
/** Nicht gewusste Wörter kommen frühestens nach so vielen anderen Karten wieder. */
export const PRACTICE_MIN_CARDS_BETWEEN = 4;
/**
 * Annahme: Ein Wort wird in einer Runde höchstens so oft gezeigt – sonst liefe die Runde bei
 * dauerhaft „nicht gewusst“ endlos weiter.
 */
export const PRACTICE_MAX_ATTEMPTS = 3;
/** Trainings-XP je „gewusst“ (zählen fürs Level, nicht für Streak oder Tagesziel). */
export const PRACTICE_XP_PER_KNOWN = 1;
