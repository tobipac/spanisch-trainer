// Extra-Übung „Schwache Wörter“: eine Runde ohne FSRS. Reine Logik, getestet.
// Sie liest nur Wort-IDs und liefert ein Ergebnis; Karten, Review-Logs und Tage bleiben unberührt.
import {
  PRACTICE_MAX_ATTEMPTS,
  PRACTICE_MAX_WORDS,
  PRACTICE_MIN_CARDS_BETWEEN,
  PRACTICE_XP_PER_KNOWN,
} from '../config/learning.ts';
import type { Direction, PracticeResult } from './types.ts';

export interface PracticeItem {
  wordId: string;
  direction: Direction;
}

interface ItemStats {
  direction: Direction;
  attempts: number;
  firstKnown: boolean | null;
  knownEventually: boolean;
}

export interface PracticeState {
  /** Reihenfolge der noch kommenden Karten; die erste ist die aktuelle */
  queue: PracticeItem[];
  stats: Record<string, ItemStats>;
  /** Wort-IDs in Rundenreihenfolge */
  words: string[];
  knownAnswers: number;
}

/**
 * Neue Runde: höchstens 10 Wörter, zufällig gemischt, Richtungen abwechselnd (Start zufällig),
 * damit Spanisch → Deutsch und Deutsch → Spanisch gemischt vorkommen.
 */
export function createPractice(weakWordIds: readonly string[], random: () => number = Math.random): PracticeState {
  const words = [...weakWordIds.slice(0, PRACTICE_MAX_WORDS)];
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [words[i], words[j]] = [words[j]!, words[i]!];
  }
  const startEsDe = random() < 0.5;
  const queue = words.map((wordId, i): PracticeItem => ({
    wordId,
    direction: (i % 2 === 0) === startEsDe ? 'es-de' : 'de-es',
  }));
  const stats = Object.fromEntries(
    queue.map((q) => [q.wordId, { direction: q.direction, attempts: 0, firstKnown: null, knownEventually: false }]),
  );
  return { queue, stats, words, knownAnswers: 0 };
}

export const currentPractice = (s: PracticeState): PracticeItem | null => s.queue[0] ?? null;

/**
 * Antwort „gewusst“ / „nicht gewusst“. Nicht gewusst: das Wort kommt in derselben Runde wieder,
 * mit mindestens 4 anderen Karten dazwischen – sofern noch so viele kommen und das Wort noch
 * nicht 3-mal gezeigt wurde.
 */
export function answerPractice(s: PracticeState, known: boolean): PracticeState {
  const [item, ...rest] = s.queue;
  if (!item) return s;
  const prev = s.stats[item.wordId]!;
  const stats = {
    ...s.stats,
    [item.wordId]: {
      ...prev,
      attempts: prev.attempts + 1,
      firstKnown: prev.firstKnown ?? known,
      knownEventually: prev.knownEventually || known,
    },
  };
  const queue = [...rest];
  if (!known && prev.attempts + 1 < PRACTICE_MAX_ATTEMPTS && rest.length >= PRACTICE_MIN_CARDS_BETWEEN) {
    queue.splice(PRACTICE_MIN_CARDS_BETWEEN, 0, item);
  }
  return { ...s, queue, stats, knownAnswers: s.knownAnswers + (known ? 1 : 0) };
}

export const isPracticeDone = (s: PracticeState) => s.queue.length === 0;

/** Ergebnis der Runde: „X von Y gewusst“ (X = beim ersten Versuch gewusst), Trainings-XP je „gewusst“. */
export function practiceResult(s: PracticeState, now: Date, day: string): PracticeResult {
  const items = s.words.map((wordId) => {
    const st = s.stats[wordId]!;
    return {
      wordId,
      direction: st.direction,
      firstKnown: st.firstKnown === true,
      attempts: st.attempts,
      knownEventually: st.knownEventually,
    };
  });
  return {
    finishedAt: now.getTime(),
    day,
    total: items.length,
    known: items.filter((i) => i.firstKnown).length,
    xp: s.knownAnswers * PRACTICE_XP_PER_KNOWN,
    items,
  };
}
