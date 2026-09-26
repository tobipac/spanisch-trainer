import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { addDays, learningDayOf } from '../src/domain/learningDay.ts';
import {
  applyRating,
  applyThrottle,
  availableReverseCards,
  createDayRecord,
  dayLimits,
  newSession,
  nextCard,
  reverseQueue,
  remainingToday,
  reverseQueueHint,
  throttleFor,
  type NextCard,
  type RatingResult,
} from '../src/domain/session.ts';
import type { CardRecord } from '../src/domain/types.ts';
import { at, learningCard, queuedReverse, reviewCard, settings, Sim, words } from './helpers.ts';

const TODAY = '2026-10-01';
const NOW = at(2026, 10, 1, 10);
const YESTERDAY = at(2026, 9, 30, 10);

const dueReviews = (n: number, due = at(2026, 10, 1, 8)) =>
  Array.from({ length: n }, (_, i) => reviewCard(`r${i}`, due));

/** Rückgängig im Speicher – dasselbe wie repository.undo in IndexedDB. */
function undoInSim(sim: Sim, r: RatingResult) {
  const u = r.undo;
  sim.cards = sim.cards.filter((c) => c.id !== u.cardId && c.id !== u.createdReverseId);
  if (u.previousCard) sim.cards.push(u.previousCard);
  sim.days.set(u.previousDay.day, u.previousDay);
  sim.session = u.previousSession;
}

const byId = (cards: CardRecord[]) => [...cards].sort((a, b) => a.id.localeCompare(b.id));

describe('Drosselung', () => {
  it('Schwellen: > 100 halbieren, > 150 null', () => {
    expect(throttleFor(100)).toBe('none');
    expect(throttleFor(101)).toBe('half');
    expect(throttleFor(150)).toBe('half');
    expect(throttleFor(151)).toBe('zero');
    expect(applyThrottle(12, 'half')).toBe(6);
    expect(applyThrottle(13, 'half')).toBe(6); // abrunden
    expect(applyThrottle(12, 'zero')).toBe(0);
  });

  it.each([
    [100, 12, 12],
    [101, 6, 6],
    [150, 6, 6],
    [151, 0, 0],
  ])('%i fällige Karten → %i neue Wörter, %i Umkehrkarten', (due, newLimit, reverseLimit) => {
    const cards = dueReviews(due);
    const day = createDayRecord(TODAY, cards, words(50), settings());
    const limits = dayLimits(day, cards, words(50), settings());
    expect(limits.newLimit).toBe(newLimit);
    expect(limits.reverseLimit).toBe(reverseLimit);
  });

  it('gedrosseltes Limit gilt in der Session', () => {
    const sim = new Sim(words(50), settings({ newPerDay: 12 }));
    sim.cards = dueReviews(120);
    const seen = sim.studyAll(NOW);
    expect(seen.filter((n) => n.kind === 'new')).toHaveLength(6);
    expect(sim.day(NOW).newDone).toBe(6);
  });

  it('bei mehr als 150 fälligen Karten keine neuen Wörter und keine Umkehrkarten', () => {
    const sim = new Sim(words(50), settings());
    sim.cards = [...dueReviews(151), queuedReverse('w0049', YESTERDAY)];
    const seen = sim.studyAll(NOW);
    expect(seen.some((n) => n.kind === 'new' || n.kind === 'reverse')).toBe(false);
  });

  it('der Snapshot zu Tagesbeginn bestimmt die Drosselung, nicht der aktuelle Stand', () => {
    const sim = new Sim(words(50), settings());
    sim.cards = dueReviews(120);
    sim.day(NOW);
    sim.cards = []; // selbst wenn später weniger fällig ist
    expect(dayLimits(sim.day(NOW), sim.cards, sim.words, sim.settings).throttle).toBe('half');
  });
});

describe('Tagesdatensatz', () => {
  it('fällig heute = eingeführt und fällig vor 04:00 des Folgetags', () => {
    const cards = [
      reviewCard('a', at(2026, 10, 1, 23)),
      reviewCard('b', at(2026, 10, 2, 3, 59)),
      reviewCard('c', at(2026, 10, 2, 4, 0)),
      queuedReverse('d', YESTERDAY),
    ];
    const day = createDayRecord(TODAY, cards, [], settings());
    expect(day.dueAtStartIds).toEqual(['a:es-de', 'b:es-de']);
  });

  it('neutraler Tag: nichts fällig und keine neuen Wörter verfügbar', () => {
    expect(createDayRecord(TODAY, [], [], settings()).neutral).toBe(true);
    expect(createDayRecord(TODAY, [], words(3), settings()).neutral).toBe(false);
    expect(createDayRecord(TODAY, dueReviews(1), [], settings()).neutral).toBe(false);
    // gedrosselt auf 0 ist nie neutral, weil dann > 150 Karten fällig sind
    expect(createDayRecord(TODAY, dueReviews(151), words(3), settings()).neutral).toBe(false);
  });
});

describe('Reihenfolge in der Session', () => {
  it('fällige Lernschritt-Karten zuerst', () => {
    const cards = [...dueReviews(3), learningCard('l', at(2026, 10, 1, 9, 59))];
    const day = createDayRecord(TODAY, cards, [], settings());
    const n = nextCard({ now: NOW, day, cards, words: [], settings: settings(), session: newSession() });
    expect(n?.kind).toBe('learning');
    expect(n?.card.id).toBe('l:es-de');
  });

  it('Wiederholungen: am längsten überfällige zuerst, auch später heute fällige', () => {
    const cards = [
      reviewCard('spaet', at(2026, 10, 1, 20)),
      reviewCard('alt', at(2026, 9, 20, 8)),
      reviewCard('mittel', at(2026, 9, 28, 8)),
    ];
    const sim = new Sim([], settings());
    sim.cards = cards;
    expect(sim.studyAll(NOW).map((n) => n.card.wordId)).toEqual(['alt', 'mittel', 'spaet']);
  });

  it('nach je 4 Wiederholungen 1 neue Karte', () => {
    const sim = new Sim(words(20), settings({ newPerDay: 5 }));
    sim.cards = dueReviews(10);
    const kinds = sim.studyAll(NOW).map((n) => n.kind).slice(0, 13);
    expect(kinds).toEqual([
      'review', 'review', 'review', 'review', 'new',
      'review', 'review', 'review', 'review', 'new',
      'review', 'review', 'new',
    ]);
  });

  it('neue Wörter nach Rang und nie über das Limit', () => {
    const sim = new Sim([...words(20)].reverse(), settings({ newPerDay: 5 }));
    const news = sim.studyAll(NOW).filter((n) => n.kind === 'new');
    expect(news.map((n) => n.card.wordId)).toEqual(['w0001', 'w0002', 'w0003', 'w0004', 'w0005']);
    expect(sim.next(new Date(NOW.getTime() + 3_600_000))).toBeNull();
  });

  it('Lernschritt-Karten der nächsten 20 min werden vorgezogen, spätere nicht', () => {
    const run = (min: number) => {
      const cards = [learningCard('l', new Date(NOW.getTime() + min * 60_000))];
      const day = createDayRecord(TODAY, cards, [], settings());
      return nextCard({ now: NOW, day, cards, words: [], settings: settings(), session: newSession() });
    };
    expect(run(15)?.kind).toBe('learning');
    expect(run(30)).toBeNull();
  });
});

describe('Umkehrkarten', () => {
  it('werden eingereiht, sobald die Spanisch → Deutsch-Karte ein Intervall ≥ 3 Tage hat', () => {
    const sim = new Sim(words(5), settings());
    sim.cards = [reviewCard('w0001', at(2026, 10, 1, 8))];
    const n = sim.next(NOW)!;
    const r = sim.rate(NOW, n, 3);
    expect(r.card.fsrs.scheduled_days).toBeGreaterThanOrEqual(3);
    expect(r.createdReverse).toMatchObject({ id: 'w0001:de-es', direction: 'de-es', introducedAt: null, queuedAt: NOW.getTime() });
  });

  it('werden nicht eingereiht bei kurzem Intervall, bei „Nochmal“ oder doppelt', () => {
    const base = { day: createDayRecord(TODAY, [], [], settings()), words: [], settings: settings(), session: newSession() };
    const short = reviewCard('a', NOW, { stability: 0.3, scheduled_days: 1, last_review: new Date(NOW.getTime() - 86_400_000) });
    const again = reviewCard('b', NOW);
    const existing = reviewCard('c', NOW);
    const rate = (card: CardRecord, rating: 1 | 2 | 3, cards: CardRecord[]) =>
      applyRating({ ...base, now: NOW, next: { kind: 'review', card }, rating, cards });

    const rShort = rate(short, 2, [short]);
    expect(rShort.card.fsrs.scheduled_days).toBeLessThan(3);
    expect(rShort.createdReverse).toBeNull();
    expect(rate(again, 1, [again]).createdReverse).toBeNull();
    expect(rate(existing, 3, [existing, queuedReverse('c', YESTERDAY)]).createdReverse).toBeNull();
    // eine Umkehrkarte erzeugt keine weitere Umkehrkarte
    const reverse = reviewCard('d', NOW, {}, 'de-es');
    expect(rate(reverse, 3, [reverse]).createdReverse).toBeNull();
  });

  it('sind erst ab dem nächsten Lerntag verfügbar', () => {
    const cards = [queuedReverse('a', at(2026, 10, 1, 5)), queuedReverse('b', at(2026, 10, 1, 3, 59))];
    expect(availableReverseCards(cards, [], TODAY).map((c) => c.wordId)).toEqual(['b']); // 03:59 = Vortag
    expect(availableReverseCards(cards, [], addDays(TODAY, 1)).map((c) => c.wordId)).toEqual(['b', 'a']);
  });

  it('Warteschlange: am längsten wartend zuerst, bei Gleichstand nach Rang', () => {
    const w = words(3);
    const cards = [
      queuedReverse('w0002', at(2026, 9, 30, 10)),
      queuedReverse('w0003', at(2026, 9, 30, 9)),
      queuedReverse('w0001', at(2026, 9, 30, 10)),
    ];
    expect(reverseQueue(cards, w).map((c) => c.wordId)).toEqual(['w0003', 'w0001', 'w0002']);
  });

  it('Tageslimit = „neue Wörter pro Tag“, der Rest bleibt in der Warteschlange', () => {
    const sim = new Sim([], settings({ newPerDay: 5 }));
    sim.cards = Array.from({ length: 8 }, (_, i) => queuedReverse(`q${i}`, YESTERDAY));
    const seen = sim.studyAll(NOW);
    expect(seen.filter((n) => n.kind === 'reverse')).toHaveLength(5);
    expect(reverseQueue(sim.cards, [])).toHaveLength(3);
    // am nächsten Tag kommen die übrigen 3
    const tomorrow = at(2026, 10, 2, 10);
    expect(sim.studyAll(tomorrow).filter((n) => n.kind === 'reverse')).toHaveLength(3);
    expect(reverseQueue(sim.cards, [])).toHaveLength(0);
  });

  it('Drosselung gilt auch für Umkehrkarten', () => {
    const sim = new Sim([], settings({ newPerDay: 5 }));
    sim.cards = [...dueReviews(101), ...Array.from({ length: 8 }, (_, i) => queuedReverse(`q${i}`, YESTERDAY))];
    expect(sim.studyAll(NOW).filter((n) => n.kind === 'reverse')).toHaveLength(2); // floor(5 / 2)
  });

  it('neue Wörter vor Umkehrkarten, beide zusätzlich zueinander', () => {
    const sim = new Sim(words(10), settings({ newPerDay: 5 }));
    sim.cards = Array.from({ length: 6 }, (_, i) => queuedReverse(`q${i}`, YESTERDAY));
    const fresh = sim.studyAll(NOW).filter((n) => n.kind === 'new' || n.kind === 'reverse').map((n) => n.kind);
    expect(fresh).toEqual(['new', 'new', 'new', 'new', 'new', 'reverse', 'reverse', 'reverse', 'reverse', 'reverse']);
  });

  it('Hinweis, wenn die Warteschlange größer als das Doppelte des Tageslimits ist', () => {
    expect(reverseQueueHint(24, settings({ newPerDay: 12 }))).toBe(false);
    expect(reverseQueueHint(25, settings({ newPerDay: 12 }))).toBe(true);
  });
});

describe('XP und Tagesziel', () => {
  it('+2 pro neuem Wort im Limit, 0 darüber, +1 pro Wiederholung und Umkehrkarte', () => {
    const w = words(3);
    const s = settings({ newPerDay: 5 });
    const day = createDayRecord(TODAY, [], w, s);
    const base = { now: NOW, words: w, settings: s, session: newSession(), cards: [] as CardRecord[] };
    const newNext: NextCard = nextCard({ ...base, day })!;
    expect(applyRating({ ...base, day, next: newNext, rating: 3 }).xpGained).toBe(2);
    // Limit (5) bereits erfüllt → zusätzliches Wort bringt keine XP
    const full = { ...day, newDone: 5, goalReached: true }; // Bonus schon vergeben
    expect(applyRating({ ...base, day: full, next: newNext, rating: 3 }).xpGained).toBe(0);

    const rev = reviewCard('x', NOW);
    const d2 = { ...createDayRecord(TODAY, [rev], [], s), goalReached: true };
    expect(applyRating({ ...base, cards: [rev], day: d2, next: { kind: 'review', card: rev }, rating: 3 }).xpGained).toBe(1);
    const q = queuedReverse('y', YESTERDAY);
    const r = applyRating({ ...base, cards: [q], day: d2, next: { kind: 'reverse', card: q }, rating: 3 });
    expect(r.xpGained).toBe(1);
    expect(r.day.reverseDone).toBe(1);
    expect(r.card.introducedAt).toBe(NOW.getTime());
  });

  it('Tagesziel: alle fälligen Karten bewertet + Limit neuer Wörter erfüllt, Bonus genau einmal', () => {
    const sim = new Sim(words(2), settings({ newPerDay: 5 }));
    sim.cards = dueReviews(3);
    const results: RatingResult[] = [];
    let now = NOW;
    for (let n = sim.next(now); n; n = sim.next(now)) {
      results.push(sim.rate(now, n, 3));
      now = new Date(now.getTime() + 10_000);
    }
    const bonus = results.filter((r) => r.day.goalReached && !r.undo.previousDay.goalReached);
    expect(bonus).toHaveLength(1);
    expect(bonus[0]!.xpGained).toBeGreaterThanOrEqual(10);
    // Ziel erst erreicht, nachdem alle 3 Wiederholungen und beide neuen Wörter bewertet waren
    const idx = results.indexOf(bonus[0]!);
    expect(results.slice(0, idx + 1).filter((r) => r.undo.previousCard?.fsrs.state === State.Review)).toHaveLength(3);
    expect(results[idx]!.day.newDone).toBe(2);
    expect(sim.day(NOW).xp).toBe(results.reduce((s, r) => s + r.xpGained, 0));
  });

  it('die erste Einführung einer Umkehrkarte zählt nicht zum Tagesziel', () => {
    const sim = new Sim(words(1), settings({ newPerDay: 5 }));
    sim.cards = [queuedReverse('q', YESTERDAY)];
    const r = sim.rate(NOW, sim.next(NOW)!, 3); // neues Wort w0001
    expect(r.day.goalReached).toBe(true);
    expect(availableReverseCards(sim.cards, sim.words, TODAY)).toHaveLength(1);
  });

  it('bereits eingeführte, fällige Umkehrkarten zählen zum Tagesziel und zur Drosselung', () => {
    const sim = new Sim([], settings());
    sim.cards = [reviewCard('a', at(2026, 10, 1, 8), {}, 'de-es')];
    expect(sim.day(NOW).dueAtStartIds).toEqual(['a:de-es']);
    expect(sim.day(NOW).goalReached).toBe(false);
    sim.studyAll(NOW);
    expect(sim.day(NOW).goalReached).toBe(true);
  });

  it('neutraler Tag: kein Tagesziel-Bonus, aber XP für freiwillige Karten', () => {
    const sim = new Sim([], settings());
    sim.cards = [queuedReverse('q', YESTERDAY)];
    expect(sim.day(NOW).neutral).toBe(true);
    sim.studyAll(NOW);
    const day = sim.day(NOW);
    expect(day.goalReached).toBe(false);
    expect(day.xp).toBeGreaterThan(0);
    expect(day.xp).toBeLessThan(10);
  });
});

describe('Rückgängig', () => {
  it('stellt Karte, Tageszähler, XP und Session exakt wieder her', () => {
    const sim = new Sim(words(5), settings());
    sim.cards = dueReviews(6);
    sim.studyAll(NOW, 3, 3); // ein paar Bewertungen vorweg
    const before = { cards: byId(sim.cards), day: structuredClone(sim.day(NOW)), session: { ...sim.session } };
    const r = sim.rate(NOW, sim.next(NOW)!, 3);
    expect(r.createdReverse).not.toBeNull();
    undoInSim(sim, r);
    expect(byId(sim.cards)).toEqual(before.cards);
    expect(sim.day(NOW)).toEqual(before.day);
    expect(sim.session).toEqual(before.session);
  });

  it('nimmt die Einführung eines neuen Worts vollständig zurück', () => {
    const sim = new Sim(words(5), settings());
    const n = sim.next(NOW)!;
    expect(n.kind).toBe('new');
    const r = sim.rate(NOW, n, 3);
    expect(r.undo.previousCard).toBeNull();
    undoInSim(sim, r);
    expect(sim.cards).toEqual([]);
    expect(sim.day(NOW).newDone).toBe(0);
    expect(sim.next(NOW)?.card.wordId).toBe('w0001');
  });

  it('nimmt ein erreichtes Tagesziel samt Bonus zurück', () => {
    const sim = new Sim([], settings());
    sim.cards = dueReviews(1);
    const r = sim.rate(NOW, sim.next(NOW)!, 3);
    expect(r.day.goalReached).toBe(true);
    undoInSim(sim, r);
    expect(sim.day(NOW).goalReached).toBe(false);
    expect(sim.day(NOW).xp).toBe(0);
  });
});

describe('Mehrtägiger Ablauf', () => {
  it('14 Lerntage mit „Gut“: Limits, Warteschlange und Tagesziel bleiben konsistent', () => {
    const s = settings({ newPerDay: 12 });
    const sim = new Sim(words(300), s);
    for (let i = 0; i < 14; i++) {
      const now = at(2026, 10, 1 + i, 19);
      const today = learningDayOf(now);
      const seen = sim.studyAll(now);
      const day = sim.day(now);
      expect(day.newDone).toBe(12);
      expect(day.reverseDone).toBeLessThanOrEqual(12);
      expect(day.goalReached).toBe(true);
      // Umkehrkarten wurden nie am Tag ihres Einreihens eingeführt
      for (const n of seen.filter((x) => x.kind === 'reverse')) {
        expect(learningDayOf(n.card.queuedAt!) < today).toBe(true);
      }
    }
    const reverseIntroduced = sim.cards.filter((c) => c.direction === 'de-es' && c.introducedAt !== null);
    expect(reverseIntroduced.length).toBeGreaterThan(0);
    // jede Umkehrkarte gehört zu einem Wort, dessen Spanisch → Deutsch-Karte existiert
    const esDe = new Set(sim.cards.filter((c) => c.direction === 'es-de').map((c) => c.wordId));
    expect(sim.cards.filter((c) => c.direction === 'de-es').every((c) => esDe.has(c.wordId))).toBe(true);
  });
});

describe('Restzählung für den Fortschrittsbalken', () => {
  it('fällige Karten + offene neue Wörter + verfügbare Umkehrkarten, sinkt beim Lernen auf 0', () => {
    const sim = new Sim(words(10), settings({ newPerDay: 5 }));
    sim.cards = [...dueReviews(3), queuedReverse('q', YESTERDAY), queuedReverse('heute', NOW)];
    const input = () => ({ day: sim.day(NOW), cards: sim.cards, words: sim.words, settings: sim.settings });
    expect(remainingToday(input())).toBe(3 + 5 + 1);
    sim.studyAll(NOW);
    expect(remainingToday({ ...input(), day: sim.day(NOW) })).toBe(0);
  });

  it('neue Wörter werden durch die verbleibenden Wörter begrenzt', () => {
    const day = createDayRecord(TODAY, [], words(2), settings({ newPerDay: 12 }));
    expect(remainingToday({ day, cards: [], words: words(2), settings: settings({ newPerDay: 12 }) })).toBe(2);
  });
});
