// Session- und Tageslogik (SPEC.md Abschnitt 4). Reine Funktionen ohne UI und ohne Datenbank:
// Sie bekommen den aktuellen Stand und liefern die geänderten Datensätze zurück.
import { State } from 'ts-fsrs';
import {
  LEARN_AHEAD_MINUTES,
  REVERSE_MIN_INTERVAL_DAYS,
  REVERSE_QUEUE_HINT_FACTOR,
  REVIEWS_PER_NEW_CARD,
  THROTTLE_HALF_ABOVE,
  THROTTLE_ZERO_ABOVE,
  XP_GOAL_BONUS,
  XP_PER_NEW_WORD,
  XP_PER_REVIEW,
} from '../config/learning.ts';
import { dayEnd, dayStart, learningDayOf } from './learningDay.ts';
import { newFsrsCard, rateCard } from './scheduler.ts';
import type { CardRecord, DayRecord, Rating, ReviewLogRecord, Settings, WordRef } from './types.ts';

export type Throttle = 'none' | 'half' | 'zero';
export type CardKind = 'learning' | 'review' | 'new' | 'reverse';

export interface NextCard {
  kind: CardKind;
  card: CardRecord;
}

/** Zustand einer laufenden Session (nur im Speicher). */
export interface SessionState {
  reviewsSinceNew: number;
}

export const newSession = (): SessionState => ({ reviewsSinceNew: 0 });

export const cardId = (wordId: string, direction: CardRecord['direction']) => `${wordId}:${direction}`;

const isIntroduced = (c: CardRecord) => c.introducedAt !== null;
const isLearningState = (c: CardRecord) => c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning;
const dueMs = (c: CardRecord) => new Date(c.fsrs.due).getTime();

// ---------- Drosselung und Limits ----------

export function throttleFor(dueCount: number): Throttle {
  if (dueCount > THROTTLE_ZERO_ABOVE) return 'zero';
  if (dueCount > THROTTLE_HALF_ABOVE) return 'half';
  return 'none';
}

export function applyThrottle(limit: number, throttle: Throttle): number {
  if (throttle === 'zero') return 0;
  if (throttle === 'half') return Math.floor(limit / 2);
  return limit;
}

/** Wörter, deren Spanisch → Deutsch-Karte noch nie eingeführt wurde, nach Rang. */
export function unintroducedWords(cards: CardRecord[], words: WordRef[]): WordRef[] {
  const introduced = new Set(cards.filter((c) => c.direction === 'es-de' && isIntroduced(c)).map((c) => c.wordId));
  return words.filter((w) => !introduced.has(w.id)).sort((a, b) => a.rank - b.rank);
}

export interface DayLimits {
  throttle: Throttle;
  /** Limit für neue Wörter nach Drosselung und begrenzt durch verfügbare Wörter. */
  newLimit: number;
  /** Limit für die Einführung von Umkehrkarten nach Drosselung. */
  reverseLimit: number;
}

export function dayLimits(day: DayRecord, cards: CardRecord[], words: WordRef[], settings: Settings): DayLimits {
  const throttle = throttleFor(day.dueAtStartIds.length);
  const available = day.newDone + unintroducedWords(cards, words).length;
  return {
    throttle,
    newLimit: Math.min(applyThrottle(settings.newPerDay, throttle), available),
    reverseLimit: applyThrottle(settings.newPerDay, throttle),
  };
}

/** Fällig heute = eingeführt und fällig vor Ende des Lerntags. */
export function dueCardIds(cards: CardRecord[], day: string): string[] {
  const end = dayEnd(day).getTime();
  return cards.filter((c) => isIntroduced(c) && dueMs(c) < end).map((c) => c.id);
}

/** Legt den Tagesdatensatz beim ersten Öffnen eines Lerntags an. */
export function createDayRecord(day: string, cards: CardRecord[], words: WordRef[], settings: Settings): DayRecord {
  const record: DayRecord = {
    day,
    newDone: 0,
    reverseDone: 0,
    reviewsDone: 0,
    goalReached: false,
    neutral: false,
    jokerUsed: false,
    xp: 0,
    dueAtStartIds: dueCardIds(cards, day),
  };
  record.neutral = record.dueAtStartIds.length === 0 && dayLimits(record, cards, words, settings).newLimit === 0;
  return record;
}

// ---------- Umkehrkarten-Warteschlange ----------

/** Alle Umkehrkarten in der Warteschlange: am längsten wartend zuerst, dann nach Rang. */
export function reverseQueue(cards: CardRecord[], words: WordRef[]): CardRecord[] {
  const rank = new Map(words.map((w) => [w.id, w.rank]));
  return cards
    .filter((c) => c.direction === 'de-es' && !isIntroduced(c) && c.queuedAt !== undefined)
    .sort((a, b) => a.queuedAt! - b.queuedAt! || (rank.get(a.wordId) ?? Infinity) - (rank.get(b.wordId) ?? Infinity));
}

/** Umkehrkarten, die heute eingeführt werden dürfen (frühestens am Lerntag nach dem Einreihen). */
export function availableReverseCards(cards: CardRecord[], words: WordRef[], day: string): CardRecord[] {
  return reverseQueue(cards, words).filter((c) => learningDayOf(c.queuedAt!) < day);
}

/** Dezenter Hinweis auf dem Heute-Screen, wenn die Warteschlange zu groß wird. */
export function reverseQueueHint(queueLength: number, settings: Settings): boolean {
  return queueLength > REVERSE_QUEUE_HINT_FACTOR * settings.newPerDay;
}

// ---------- Nächste Karte ----------

export interface NextCardInput {
  now: Date;
  day: DayRecord;
  cards: CardRecord[];
  words: WordRef[];
  settings: Settings;
  session: SessionState;
}

/**
 * Reihenfolge: 1. fällige Lernschritt-Karten, 2. fällige Wiederholungen (am längsten überfällig zuerst),
 * 3. neue Karten eingestreut (nach je 4 Wiederholungen 1 neue; erst neue Wörter, dann Umkehrkarten).
 * Liefert null, wenn für heute nichts mehr zu tun ist.
 */
export function nextCard({ now, day, cards, words, settings, session }: NextCardInput): NextCard | null {
  const nowMs = now.getTime();
  const end = dayEnd(day.day).getTime();
  const introduced = cards.filter(isIntroduced);

  const learning = introduced.filter((c) => isLearningState(c) && dueMs(c) <= nowMs).sort((a, b) => dueMs(a) - dueMs(b));
  if (learning[0]) return { kind: 'learning', card: learning[0] };

  const review = introduced
    .filter((c) => c.fsrs.state === State.Review && dueMs(c) < end)
    .sort((a, b) => dueMs(a) - dueMs(b))[0];

  const limits = dayLimits(day, cards, words, settings);
  const newCard = (): NextCard | null => {
    if (day.newDone < limits.newLimit) {
      const word = unintroducedWords(cards, words)[0];
      if (word) {
        const id = cardId(word.id, 'es-de');
        const existing = cards.find((c) => c.id === id);
        return {
          kind: 'new',
          card: existing ?? { id, wordId: word.id, direction: 'es-de', fsrs: newFsrsCard(now), introducedAt: null },
        };
      }
    }
    if (day.reverseDone < limits.reverseLimit) {
      const reverse = availableReverseCards(cards, words, day.day)[0];
      if (reverse) return { kind: 'reverse', card: reverse };
    }
    return null;
  };

  if (review && session.reviewsSinceNew < REVIEWS_PER_NEW_CARD) return { kind: 'review', card: review };
  const fresh = newCard();
  if (fresh) return fresh;
  if (review) return { kind: 'review', card: review };

  // Nichts mehr fällig: Lernschritt-Karten der nächsten Minuten vorziehen, statt warten zu lassen.
  const ahead = introduced
    .filter((c) => isLearningState(c) && dueMs(c) <= nowMs + LEARN_AHEAD_MINUTES * 60_000)
    .sort((a, b) => dueMs(a) - dueMs(b))[0];
  return ahead ? { kind: 'learning', card: ahead } : null;
}

/**
 * Geschätzte Anzahl Karten, die heute noch drankommen (für Fortschrittsbalken und Zeitschätzung).
 * Lernschritt-Karten zählen einmal, auch wenn sie mehrfach wiederkommen können.
 */
export function remainingToday({ day, cards, words, settings }: Omit<NextCardInput, 'now' | 'session'>): number {
  const end = dayEnd(day.day).getTime();
  const due = cards.filter((c) => isIntroduced(c) && dueMs(c) < end).length;
  const limits = dayLimits(day, cards, words, settings);
  const newLeft = Math.max(0, Math.min(limits.newLimit - day.newDone, unintroducedWords(cards, words).length));
  const reverseLeft = Math.max(
    0,
    Math.min(limits.reverseLimit - day.reverseDone, availableReverseCards(cards, words, day.day).length),
  );
  return due + newLeft + reverseLeft;
}

// ---------- Tagesziel ----------

/** Tagesziel: alle zu Tagesbeginn fälligen Karten heute bewertet und Limit für neue Wörter erfüllt. */
export function isGoalReached(day: DayRecord, cards: CardRecord[], words: WordRef[], settings: Settings): boolean {
  const start = dayStart(day.day).getTime();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const allRated = day.dueAtStartIds.every((id) => {
    const lr = byId.get(id)?.fsrs.last_review;
    return lr !== undefined && new Date(lr).getTime() >= start;
  });
  return allRated && day.newDone >= dayLimits(day, cards, words, settings).newLimit;
}

// ---------- Bewertung und Rückgängig ----------

/** Alles, was nötig ist, um eine Bewertung vollständig zurückzunehmen. */
export interface UndoEntry {
  cardId: string;
  previousCard: CardRecord | null; // null = Datensatz war neu und wird wieder entfernt
  previousDay: DayRecord;
  createdReverseId: string | null;
  previousSession: SessionState;
}

export interface RatingInput {
  now: Date;
  next: NextCard;
  rating: Rating;
  day: DayRecord;
  cards: CardRecord[];
  words: WordRef[];
  settings: Settings;
  session: SessionState;
}

export interface RatingResult {
  card: CardRecord;
  log: ReviewLogRecord;
  day: DayRecord;
  createdReverse: CardRecord | null;
  session: SessionState;
  xpGained: number;
  undo: UndoEntry;
}

export function applyRating(input: RatingInput): RatingResult {
  const { now, next, rating, day, cards, words, settings, session } = input;
  const before = next.card;
  const { card: fsrsCard, log } = rateCard(before.fsrs, rating, now);
  const card: CardRecord = { ...before, fsrs: fsrsCard, introducedAt: before.introducedAt ?? now.getTime() };

  const limits = dayLimits(day, cards, words, settings);
  const updatedDay: DayRecord = { ...day, dueAtStartIds: [...day.dueAtStartIds] };
  let xp = 0;
  if (next.kind === 'new') {
    // Keine XP für zusätzliche neue Wörter über das Limit hinaus.
    if (day.newDone < limits.newLimit) xp += XP_PER_NEW_WORD;
    updatedDay.newDone += 1;
  } else if (next.kind === 'reverse') {
    xp += XP_PER_REVIEW;
    updatedDay.reverseDone += 1;
  } else {
    xp += XP_PER_REVIEW;
    updatedDay.reviewsDone += 1;
  }

  // Umkehrkarte einreihen, sobald die Spanisch → Deutsch-Karte ein Intervall ≥ 3 Tage hat.
  let createdReverse: CardRecord | null = null;
  const reverseId = cardId(card.wordId, 'de-es');
  if (
    card.direction === 'es-de' &&
    fsrsCard.state === State.Review &&
    fsrsCard.scheduled_days >= REVERSE_MIN_INTERVAL_DAYS &&
    !cards.some((c) => c.id === reverseId)
  ) {
    createdReverse = {
      id: reverseId,
      wordId: card.wordId,
      direction: 'de-es',
      fsrs: newFsrsCard(now),
      introducedAt: null,
      queuedAt: now.getTime(),
    };
  }

  const cardsAfter = [...cards.filter((c) => c.id !== card.id), card];
  if (createdReverse) cardsAfter.push(createdReverse);
  if (!day.goalReached && !day.neutral && isGoalReached(updatedDay, cardsAfter, words, settings)) {
    updatedDay.goalReached = true;
    xp += XP_GOAL_BONUS;
  }
  updatedDay.xp += xp;

  const isNewOrReverse = next.kind === 'new' || next.kind === 'reverse';
  return {
    card,
    log: { cardId: card.id, rating, reviewedAt: now.getTime(), log },
    day: updatedDay,
    createdReverse,
    session: { reviewsSinceNew: isNewOrReverse ? 0 : session.reviewsSinceNew + 1 },
    xpGained: xp,
    undo: {
      cardId: card.id,
      previousCard: cards.some((c) => c.id === before.id) ? before : null,
      previousDay: day,
      createdReverseId: createdReverse?.id ?? null,
      previousSession: session,
    },
  };
}
