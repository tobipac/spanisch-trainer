import { createEmptyCard, State, type Card } from 'ts-fsrs';
import { DEFAULT_SETTINGS } from '../src/db/repository.ts';
import { learningDayOf } from '../src/domain/learningDay.ts';
import {
  applyRating,
  createDayRecord,
  newSession,
  nextCard,
  type NextCard,
  type SessionState,
} from '../src/domain/session.ts';
import type { CardRecord, DayRecord, Rating, Settings, WordRef } from '../src/domain/types.ts';

const DAY_MS = 86_400_000;

/** Lokale Zeit in Europe/Vienna. */
export const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

export const words = (n: number): WordRef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `w${String(i + 1).padStart(4, '0')}`, rank: i + 1 }));

export const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

/** Eingeführte Karte im Zustand Review mit gegebener Fälligkeit. */
export function reviewCard(
  wordId: string,
  due: Date,
  over: Partial<Card> = {},
  direction: CardRecord['direction'] = 'es-de',
): CardRecord {
  const base = createEmptyCard(new Date(due.getTime() - 10 * DAY_MS));
  return {
    id: `${wordId}:${direction}`,
    wordId,
    direction,
    introducedAt: due.getTime() - 20 * DAY_MS,
    fsrs: {
      ...base,
      state: State.Review,
      due,
      stability: 10,
      difficulty: 5,
      scheduled_days: 10,
      reps: 3,
      last_review: new Date(due.getTime() - 10 * DAY_MS),
      ...over,
    },
  };
}

/** Eingeführte Karte in einem Lernschritt. */
export function learningCard(wordId: string, due: Date): CardRecord {
  return reviewCard(wordId, due, {
    state: State.Learning,
    stability: 0.5,
    scheduled_days: 0,
    learning_steps: 1,
    last_review: new Date(due.getTime() - 10 * 60_000),
  });
}

/** Umkehrkarte in der Warteschlange. */
export function queuedReverse(wordId: string, queuedAt: Date): CardRecord {
  return {
    id: `${wordId}:de-es`,
    wordId,
    direction: 'de-es',
    introducedAt: null,
    queuedAt: queuedAt.getTime(),
    fsrs: createEmptyCard(queuedAt),
  };
}

/** In-Memory-Ablauf, der genau das tut, was repository.ts in IndexedDB tut. */
export class Sim {
  cards: CardRecord[] = [];
  days = new Map<string, DayRecord>();
  session: SessionState = newSession();
  words: WordRef[];
  settings: Settings;

  constructor(wordList: WordRef[], s: Settings = DEFAULT_SETTINGS) {
    this.words = wordList;
    this.settings = s;
  }

  day(now: Date): DayRecord {
    const key = learningDayOf(now);
    let d = this.days.get(key);
    if (!d) {
      d = createDayRecord(key, this.cards, this.words, this.settings);
      this.days.set(key, d);
    }
    return d;
  }

  next(now: Date): NextCard | null {
    return nextCard({
      now,
      day: this.day(now),
      cards: this.cards,
      words: this.words,
      settings: this.settings,
      session: this.session,
    });
  }

  rate(now: Date, next: NextCard, rating: Rating) {
    const r = applyRating({
      now,
      next,
      rating,
      day: this.day(now),
      cards: this.cards,
      words: this.words,
      settings: this.settings,
      session: this.session,
    });
    this.cards = [...this.cards.filter((c) => c.id !== r.card.id), r.card];
    if (r.createdReverse) this.cards.push(r.createdReverse);
    this.days.set(r.day.day, r.day);
    this.session = r.session;
    return r;
  }

  /** Lernt, bis nichts mehr kommt. Bewertung fest, Zeit läuft je Karte 10 s weiter. */
  studyAll(start: Date, rating: Rating = 3, max = 2000): NextCard[] {
    let now = start;
    const seen: NextCard[] = [];
    for (let i = 0; i < max; i++) {
      const n = this.next(now);
      if (!n) break;
      seen.push(n);
      this.rate(now, n, rating);
      now = new Date(now.getTime() + 10_000);
    }
    return seen;
  }
}
