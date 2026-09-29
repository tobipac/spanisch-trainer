// Session- und Tageslogik (SPEC.md Abschnitt 4). Reine Funktionen ohne UI und ohne Datenbank:
// Sie bekommen den aktuellen Stand und liefern die geänderten Datensätze zurück.
import { State } from 'ts-fsrs';
import {
  LEARNING_GAP_FALLBACK_MINUTES,
  LEARNING_MIN_CARDS_BETWEEN,
  REVERSE_MIN_INTERVAL_DAYS,
  REVERSE_QUEUE_HINT_FACTOR,
  REVIEWS_PER_NEW_CARD,
  SECONDS_PER_VIEW,
  THROTTLE_HALF_ABOVE,
  THROTTLE_ZERO_ABOVE,
  VIEWS_PER_NEW_CARD,
  VIEWS_PER_REVIEW,
  XP_GOAL_BONUS,
  XP_PER_NEW_WORD,
  XP_PER_REVIEW,
} from '../config/learning.ts';
import { addDays, dayEnd, dayStart, learningDayOf } from './learningDay.ts';
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
  /** Anzahl bisher bewerteter Karten in dieser Session */
  shown: number;
  /** je Karte: Wert von `shown` bei ihrer letzten Bewertung in dieser Session */
  lastShown: Record<string, number>;
  /** Karten, die in dieser Session mit „Nochmal“ bewertet wurden (dafür ist „Leicht“ gesperrt) */
  againIds: string[];
}

export const newSession = (): SessionState => ({ reviewsSinceNew: 0, shown: 0, lastShown: {}, againIds: [] });

export const cardId = (wordId: string, direction: CardRecord['direction']) => `${wordId}:${direction}`;

const isIntroduced = (c: CardRecord) => c.introducedAt !== null;
const isLearningState = (c: CardRecord) => c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning;
const dueMs = (c: CardRecord) => new Date(c.fsrs.due).getTime();

// ---------- Geschwister (beide Richtungen eines Wortes) ----------

const siblingId = (c: CardRecord) => cardId(c.wordId, c.direction === 'es-de' ? 'de-es' : 'es-de');
const reviewedMs = (c: CardRecord) => (c.fsrs.last_review ? new Date(c.fsrs.last_review).getTime() : null);
const ratedOnDay = (c: CardRecord, day: string) => (reviewedMs(c) ?? -Infinity) >= dayStart(day).getTime();

/**
 * Geschwister-Sperre: Wurde die andere Richtung heute bewertet (und diese Karte noch nicht),
 * erscheint die Karte heute nicht mehr.
 */
export function isSiblingBlocked(card: CardRecord, byId: ReadonlyMap<string, CardRecord>, day: string): boolean {
  const sibling = byId.get(siblingId(card));
  return sibling !== undefined && sibling.introducedAt !== null && ratedOnDay(sibling, day) && !ratedOnDay(card, day);
}

/**
 * Zu Beginn eines Lerntags: Sind beide Richtungen eines Wortes heute fällig, bleibt eine (Lernschritt
 * vor Wiederholung, sonst Spanisch → Deutsch); die andere wird ohne Bewertung auf den Beginn des
 * nächsten Lerntags verschoben. Liefert die geänderten Karten.
 */
export function siblingsToPostpone(cards: CardRecord[], day: string): CardRecord[] {
  const end = dayEnd(day).getTime();
  const next = dayStart(addDays(day, 1));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const dueToday = (c: CardRecord | undefined): c is CardRecord => !!c && isIntroduced(c) && dueMs(c) < end;
  const out: CardRecord[] = [];
  for (const c of cards) {
    if (c.direction !== 'es-de' || !dueToday(c)) continue;
    const reverse = byId.get(siblingId(c));
    if (!dueToday(reverse)) continue;
    const keepReverse = isLearningState(reverse) && !isLearningState(c);
    const postponed = keepReverse ? c : reverse;
    out.push({ ...postponed, fsrs: { ...postponed.fsrs, due: next } });
  }
  return out;
}

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

/**
 * Umkehrkarten, die heute eingeführt werden dürfen: frühestens am Lerntag nach dem Einreihen und nicht,
 * wenn die Spanisch → Deutsch-Karte heute fällig ist oder bewertet wurde (Geschwister-Sperre).
 */
export function availableReverseCards(cards: CardRecord[], words: WordRef[], day: string): CardRecord[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const end = dayEnd(day).getTime();
  return reverseQueue(cards, words).filter((c) => {
    const es = byId.get(siblingId(c));
    const esBusy = es !== undefined && isIntroduced(es) && (dueMs(es) < end || ratedOnDay(es, day));
    return learningDayOf(c.queuedAt!) < day && !esBusy;
  });
}

/** Dezenter Hinweis auf dem Heute-Screen, wenn die Warteschlange zu groß wird. */
export function reverseQueueHint(queueLength: number, settings: Settings): boolean {
  return queueLength > REVERSE_QUEUE_HINT_FACTOR * settings.newPerDay;
}

// ---------- Abstand bei Lernschritt-Karten ----------

const lastReviewMs = (c: CardRecord) => (c.fsrs.last_review ? new Date(c.fsrs.last_review).getTime() : null);

/**
 * Wie viele andere Karten seit der letzten Ansicht gezeigt wurden: in dieser Session exakt gezählt,
 * sonst (Karte aus einer früheren Session) die anderen Karten, die seitdem bewertet wurden.
 */
export function cardsSinceLastView(card: CardRecord, cards: CardRecord[], session: SessionState): number {
  const pos = session.lastShown[card.id];
  if (pos !== undefined) return session.shown - pos - 1;
  const last = lastReviewMs(card);
  if (last === null) return Infinity;
  return cards.filter((c) => c.id !== card.id && (lastReviewMs(c) ?? -Infinity) > last).length;
}

/**
 * Frühester Zeitpunkt, zu dem eine Lernschritt-Karte gezeigt werden darf: ihr `due`, und – solange
 * noch keine 4 anderen Karten dazwischen lagen – frühestens 10 min nach der letzten Ansicht.
 */
export function learningReadyAt(card: CardRecord, cards: CardRecord[], session: SessionState): number {
  const due = dueMs(card);
  if (cardsSinceLastView(card, cards, session) >= LEARNING_MIN_CARDS_BETWEEN) return due;
  const last = lastReviewMs(card);
  return last === null ? due : Math.max(due, last + LEARNING_GAP_FALLBACK_MINUTES * 60_000);
}

export interface LaterLearning {
  /** Lernschritt-Karten, die heute noch kommen, aber jetzt noch nicht gezeigt werden dürfen */
  count: number;
  /** Minuten bis zur ersten davon (aufgerundet, mindestens 1) */
  minutes: number;
  /** Zeitpunkt der ersten davon (ms) */
  firstAt: number;
}

/** Lernschritt-Karten, die heute später zurückkommen (für Session-Ende und Heute-Screen), sonst null. */
export function laterLearning(input: Pick<NextCardInput, 'now' | 'day' | 'cards' | 'session'>): LaterLearning | null {
  const nowMs = input.now.getTime();
  const end = dayEnd(input.day.day).getTime();
  const byId = new Map(input.cards.map((c) => [c.id, c]));
  const times = input.cards
    .filter((c) => isIntroduced(c) && isLearningState(c) && dueMs(c) < end && !isSiblingBlocked(c, byId, input.day.day))
    .map((c) => learningReadyAt(c, input.cards, input.session))
    .filter((t) => t > nowMs);
  if (times.length === 0) return null;
  const firstAt = Math.min(...times);
  return { count: times.length, minutes: Math.max(1, Math.ceil((firstAt - nowMs) / 60_000)), firstAt };
}

/** „Leicht“ ist gesperrt, wenn die Karte in dieser Session schon „Nochmal“ bekam. */
export function isRatingAllowed(session: SessionState, cardId: string, rating: Rating): boolean {
  return !(rating === 4 && session.againIds.includes(cardId));
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
 * Reihenfolge: 1. zeigbare Lernschritt-Karten (fällig und genug Abstand, siehe learningReadyAt),
 * 2. fällige Wiederholungen (am längsten überfällig zuerst), 3. neue Karten eingestreut (nach je
 * 4 Wiederholungen 1 neue; erst neue Wörter, dann Umkehrkarten).
 * Liefert null, wenn jetzt nichts zeigbar ist – Lernschritt-Karten werden nie im Voraus gezeigt.
 */
export function nextCard({ now, day, cards, words, settings, session }: NextCardInput): NextCard | null {
  const nowMs = now.getTime();
  const end = dayEnd(day.day).getTime();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const introduced = cards.filter((c) => isIntroduced(c) && !isSiblingBlocked(c, byId, day.day));

  const learning = introduced
    .filter((c) => isLearningState(c) && learningReadyAt(c, cards, session) <= nowMs)
    .sort((a, b) => dueMs(a) - dueMs(b));
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
  return review ? { kind: 'review', card: review } : null;
}

export interface TodayCounts {
  /** eingeführte Karten, die heute noch fällig sind (inkl. Lernschritte und fälliger Umkehrkarten) */
  due: number;
  /** neue Wörter, die heute noch eingeführt werden (nach Drosselung) */
  newLeft: number;
  /** Umkehrkarten aus der Warteschlange, die heute noch eingeführt werden */
  reverseLeft: number;
  /** alle Umkehrkarten in der Warteschlange (auch die erst morgen verfügbaren) */
  reverseQueued: number;
}

export function todayCounts({ day, cards, words, settings }: Omit<NextCardInput, 'now' | 'session'>): TodayCounts {
  const end = dayEnd(day.day).getTime();
  const limits = dayLimits(day, cards, words, settings);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return {
    due: cards.filter((c) => isIntroduced(c) && dueMs(c) < end && !isSiblingBlocked(c, byId, day.day)).length,
    newLeft: Math.max(0, Math.min(limits.newLimit - day.newDone, unintroducedWords(cards, words).length)),
    reverseLeft: Math.max(
      0,
      Math.min(limits.reverseLimit - day.reverseDone, availableReverseCards(cards, words, day.day).length),
    ),
    reverseQueued: reverseQueue(cards, words).length,
  };
}

/**
 * Geschätzte Anzahl Karten, die heute noch drankommen (für Fortschrittsbalken und Zeitschätzung).
 * Lernschritt-Karten zählen einmal, auch wenn sie mehrfach wiederkommen können.
 */
export function remainingToday(input: Omit<NextCardInput, 'now' | 'session'>): number {
  const c = todayCounts(input);
  return c.due + c.newLeft + c.reverseLeft;
}

/** Geschätzte Minuten für den Rest des Tages (Annahmen siehe config/learning.ts). */
export function estimateMinutes(counts: Pick<TodayCounts, 'due' | 'newLeft' | 'reverseLeft'>): number {
  const views = counts.due * VIEWS_PER_REVIEW + (counts.newLeft + counts.reverseLeft) * VIEWS_PER_NEW_CARD;
  return Math.ceil((views * SECONDS_PER_VIEW) / 60);
}

// ---------- Tagesziel ----------

/** Tagesziel: alle zu Tagesbeginn fälligen Karten heute bewertet und Limit für neue Wörter erfüllt. */
/** Zu Tagesbeginn fällige Karte heute erledigt: bewertet oder durch die Geschwister-Sperre ausgesetzt. */
function doneToday(id: string, byId: ReadonlyMap<string, CardRecord>, day: string): boolean {
  const c = byId.get(id);
  return c !== undefined && (ratedOnDay(c, day) || isSiblingBlocked(c, byId, day));
}

export function isGoalReached(day: DayRecord, cards: CardRecord[], words: WordRef[], settings: Settings): boolean {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const allRated = day.dueAtStartIds.every((id) => doneToday(id, byId, day.day));
  return allRated && day.newDone >= dayLimits(day, cards, words, settings).newLimit;
}

/** Fortschritt Richtung Tagesziel für den Tagesring: bewertete fällige Karten + eingeführte neue Wörter. */
export function goalProgress(
  day: DayRecord,
  cards: CardRecord[],
  words: WordRef[],
  settings: Settings,
): { done: number; total: number } {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const rated = day.dueAtStartIds.filter((id) => doneToday(id, byId, day.day)).length;
  const { newLimit } = dayLimits(day, cards, words, settings);
  return { done: rated + Math.min(day.newDone, newLimit), total: day.dueAtStartIds.length + newLimit };
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
  /**
   * „Kenne ich schon“ bei der ersten Ansicht eines neuen Wortes: FSRS-Bewertung „Leicht“, keine
   * Umkehrkarte (auch später nicht), zählt nicht zum Limit neuer Wörter.
   */
  knownAtIntro?: boolean;
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
  const { now, next, day, cards, words, settings, session } = input;
  const known = input.knownAtIntro === true;
  if (known && next.kind !== 'new') throw new Error('„Kenne ich schon“ gibt es nur bei einem neuen Wort');
  const rating: Rating = known ? 4 : input.rating;
  const before = next.card;
  if (!isRatingAllowed(session, before.id, rating)) throw new Error('„Leicht“ ist nach „Nochmal“ in dieser Session gesperrt');
  const { card: fsrsCard, log } = rateCard(before.fsrs, rating, now);
  const card: CardRecord = {
    ...before,
    fsrs: fsrsCard,
    introducedAt: before.introducedAt ?? now.getTime(),
    ...(known ? { knownAtIntro: true as const } : {}),
  };

  const limits = dayLimits(day, cards, words, settings);
  const updatedDay: DayRecord = { ...day, dueAtStartIds: [...day.dueAtStartIds] };
  let xp = 0;
  if (known) {
    // zählt nicht zum Limit neuer Wörter, keine XP
  } else if (next.kind === 'new') {
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
    !card.knownAtIntro &&
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
    session: {
      // „Kenne ich schon“: Zähler unverändert, damit gleich das nächste neue Wort kommen kann
      reviewsSinceNew: known ? session.reviewsSinceNew : isNewOrReverse ? 0 : session.reviewsSinceNew + 1,
      shown: session.shown + 1,
      lastShown: { ...session.lastShown, [card.id]: session.shown },
      againIds: rating === 1 && !session.againIds.includes(card.id) ? [...session.againIds, card.id] : session.againIds,
    },
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
