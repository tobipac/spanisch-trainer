import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PRACTICE_MAX_ATTEMPTS,
  PRACTICE_MAX_WORDS,
  PRACTICE_MIN_CARDS_BETWEEN,
  PRACTICE_XP_PER_KNOWN,
} from '../src/config/learning.ts';
import { getOrCreateDay, loadSettings, practiceXp, rate, savePracticeResult } from '../src/db/repository.ts';
import { TrainerDB } from '../src/db/schema.ts';
import { levelInfo } from '../src/domain/gamification.ts';
import {
  answerPractice,
  createPractice,
  currentPractice,
  isPracticeDone,
  practiceResult,
  type PracticeState,
} from '../src/domain/practice.ts';
import { goalProgress, newSession, nextCard, todayCounts } from '../src/domain/session.ts';
import { at, words } from './helpers.ts';

const NOW = at(2026, 10, 1, 18);
const ids = (n: number) => Array.from({ length: n }, (_, i) => `w${String(i + 1).padStart(4, '0')}`);
/** fester Zufall für reproduzierbare Runden */
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/** Spielt eine Runde durch; `known(wordId, attempt)` entscheidet die Antwort. */
function play(s: PracticeState, known: (wordId: string, attempt: number) => boolean) {
  const seen: string[] = [];
  const attempts = new Map<string, number>();
  while (!isPracticeDone(s)) {
    const item = currentPractice(s)!;
    const a = (attempts.get(item.wordId) ?? 0) + 1;
    attempts.set(item.wordId, a);
    seen.push(item.wordId);
    s = answerPractice(s, known(item.wordId, a));
  }
  return { s, seen };
}

describe('Runde „Schwache Wörter“', () => {
  it(`höchstens ${PRACTICE_MAX_WORDS} Wörter, gemischt Spanisch → Deutsch und Deutsch → Spanisch`, () => {
    const s = createPractice(ids(14), seeded());
    expect(s.queue).toHaveLength(PRACTICE_MAX_WORDS);
    expect(new Set(s.queue.map((q) => q.wordId)).size).toBe(PRACTICE_MAX_WORDS);
    const dirs = s.queue.map((q) => q.direction);
    expect(dirs.filter((d) => d === 'es-de')).toHaveLength(5);
    expect(dirs.filter((d) => d === 'de-es')).toHaveLength(5);
  });

  it(`nicht gewusst: kommt wieder, mit mindestens ${PRACTICE_MIN_CARDS_BETWEEN} anderen Karten dazwischen`, () => {
    const { seen } = play(createPractice(ids(10), seeded(7)), (id, attempt) => !(['w0002', 'w0005'].includes(id) && attempt === 1));
    for (const id of ['w0002', 'w0005']) {
      const first = seen.indexOf(id);
      const second = seen.indexOf(id, first + 1);
      expect(second).toBeGreaterThan(first);
      expect(second - first - 1).toBeGreaterThanOrEqual(PRACTICE_MIN_CARDS_BETWEEN);
    }
    // alle anderen genau einmal
    expect(seen).toHaveLength(12);
  });

  it('kein Wiederzeigen, wenn nicht mehr genug andere Karten kommen, und höchstens 3 Versuche', () => {
    const tooFew = play(createPractice(ids(3), seeded(3)), () => false);
    expect(tooFew.seen).toHaveLength(3);
    const never = play(createPractice(ids(10), seeded(5)), () => false);
    const counts = new Map<string, number>();
    never.seen.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(PRACTICE_MAX_ATTEMPTS);
    for (let i = 0; i < never.seen.length; i++) {
      const prev = never.seen.lastIndexOf(never.seen[i]!, i - 1);
      if (i > 0 && prev >= 0) expect(i - prev - 1).toBeGreaterThanOrEqual(PRACTICE_MIN_CARDS_BETWEEN);
    }
  });

  it('Ergebnis „X von Y gewusst“ (erster Versuch) und Trainings-XP je „gewusst“', () => {
    // random 0.99: Reihenfolge bleibt, w0001 kommt zuerst und hat genug Karten zum Wiederholen
    const { s } = play(createPractice(ids(6), () => 0.99), (id, attempt) => id !== 'w0001' || attempt > 1);
    const r = practiceResult(s, NOW, '2026-10-01');
    expect(r).toMatchObject({ total: 6, known: 5, xp: 6 * PRACTICE_XP_PER_KNOWN, day: '2026-10-01' });
    expect(r.items.find((i) => i.wordId === 'w0001')).toMatchObject({ firstKnown: false, knownEventually: true, attempts: 2 });
  });
});

describe('Extra-Übung verändert den Lernplan nicht', () => {
  let db: TrainerDB;
  let n = 0;
  beforeEach(async () => {
    db = new TrainerDB(`practice-${n++}`);
    await db.open();
  });
  afterEach(async () => {
    await db.delete();
  });

  it('Karten, Review-Logs, Tage, nächste Karte, Zähler und Tagesziel bleiben gleich; XP nur im Level', async () => {
    const W = words(6);
    // etwas lernen, damit Karten, Logs und ein Tag existieren
    let now = at(2026, 10, 1, 10);
    for (let i = 0; i < 6; i++) {
      const day = await getOrCreateDay(db, now, W);
      const next = nextCard({ now, day, cards: await db.cards.toArray(), words: W, settings: await loadSettings(db), session: newSession() });
      if (!next) break;
      await rate(db, { now, next, rating: 1, words: W, session: newSession() });
      now = new Date(now.getTime() + 60_000);
    }
    const snapshot = async () => ({
      cards: (await db.cards.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
      logs: await db.reviewLogs.toArray(),
      days: await db.days.toArray(),
    });
    const plan = async () => {
      const day = await getOrCreateDay(db, NOW, W);
      const cards = await db.cards.toArray();
      const settings = await loadSettings(db);
      return {
        next: nextCard({ now: NOW, day, cards, words: W, settings, session: newSession() })?.card.id ?? null,
        counts: todayCounts({ day, cards, words: W, settings }),
        progress: goalProgress(day, cards, W, settings),
        goal: day.goalReached,
      };
    };
    const before = { data: await snapshot(), plan: await plan() };
    const daysBefore = await db.days.toArray();

    const { s } = play(createPractice(ids(6), seeded()), (_, a) => a > 1);
    const result = practiceResult(s, NOW, '2026-10-01');
    await savePracticeResult(db, result);

    expect(await snapshot()).toEqual(before.data);
    expect(await plan()).toEqual(before.plan);
    expect(await db.practiceResults.count()).toBe(1);
    expect(await practiceXp(db)).toBe(result.xp);
    expect(levelInfo(daysBefore, await practiceXp(db)).totalXp).toBe(levelInfo(daysBefore).totalXp + result.xp);
  });
});
