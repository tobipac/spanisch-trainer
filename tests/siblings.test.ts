import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { addDays, dayStart } from '../src/domain/learningDay.ts';
import {
  availableReverseCards,
  createDayRecord,
  isGoalReached,
  isSiblingBlocked,
  newSession,
  nextCard,
  siblingsToPostpone,
  todayCounts,
} from '../src/domain/session.ts';
import type { CardRecord } from '../src/domain/types.ts';
import { at, queuedReverse, reviewCard, settings, Sim, words } from './helpers.ts';

const TODAY = '2026-10-01';
const NOW = at(2026, 10, 1, 10);
const TOMORROW_START = dayStart(addDays(TODAY, 1));

const es = (id: string, due: Date, over = {}) => reviewCard(id, due, over, 'es-de');
const de = (id: string, due: Date, over = {}) => reviewCard(id, due, over, 'de-es');

describe('Geschwister-Sperre: beide Richtungen am selben Lerntag fällig', () => {
  it('Spanisch → Deutsch bleibt, Deutsch → Spanisch wird ohne Bewertung auf morgen verschoben', () => {
    const cards = [es('a', at(2026, 10, 1, 8)), de('a', at(2026, 10, 1, 9)), es('b', at(2026, 10, 1, 8))];
    const moved = siblingsToPostpone(cards, TODAY);
    expect(moved.map((c) => c.id)).toEqual(['a:de-es']);
    expect(moved[0]!.fsrs.due).toEqual(TOMORROW_START);
    // sonst unverändert: keine FSRS-Bewertung
    const { due: _d1, ...before } = cards[1]!.fsrs;
    const { due: _d2, ...after } = moved[0]!.fsrs;
    expect(after).toEqual(before);
  });

  it('eine Karte im Lernschritt hat Vorrang vor der Wiederholung', () => {
    const cards = [es('a', at(2026, 10, 1, 8)), de('a', at(2026, 10, 1, 9), { state: State.Relearning })];
    expect(siblingsToPostpone(cards, TODAY).map((c) => c.id)).toEqual(['a:es-de']);
  });

  it('nur eine Richtung fällig: nichts wird verschoben', () => {
    expect(siblingsToPostpone([es('a', at(2026, 10, 1, 8)), de('a', at(2026, 10, 3, 8))], TODAY)).toEqual([]);
  });

  it('in der Session erscheint pro Wort nur eine Richtung, das Tagesziel ist erreichbar', () => {
    const sim = new Sim(words(0), settings({ newPerDay: 0 }));
    sim.cards = [es('a', at(2026, 10, 1, 8)), de('a', at(2026, 10, 1, 8)), es('b', at(2026, 10, 1, 8)), de('b', at(2026, 10, 1, 8))];
    const seen = sim.studyAll(NOW).map((n) => n.card.id);
    expect(seen.sort()).toEqual(['a:es-de', 'b:es-de']);
    expect(sim.day(NOW).goalReached).toBe(true);
    // am nächsten Lerntag kommt die verschobene Richtung
    const tomorrow = at(2026, 10, 2, 10);
    expect(sim.studyAll(tomorrow).map((n) => n.card.id).sort()).toEqual(['a:de-es', 'b:de-es']);
  });
});

describe('Geschwister-Sperre: eine Richtung heute bewertet', () => {
  const ratedToday = (c: CardRecord) => ({ ...c, fsrs: { ...c.fsrs, last_review: at(2026, 10, 1, 9) } });

  it('die andere Richtung erscheint heute nicht mehr', () => {
    const esCard = ratedToday(es('a', at(2026, 10, 8)));
    const deCard = de('a', at(2026, 10, 1, 11), { state: State.Learning }); // z. B. Lernschritt später heute
    const cards = [esCard, deCard];
    const byId = new Map(cards.map((c) => [c.id, c]));
    expect(isSiblingBlocked(deCard, byId, TODAY)).toBe(true);
    expect(isSiblingBlocked(esCard, byId, TODAY)).toBe(false);
    const day = createDayRecord(TODAY, cards, [], settings());
    const input = { now: at(2026, 10, 1, 12), day, cards, words: [], settings: settings(), session: newSession() };
    expect(nextCard(input)).toBeNull();
    expect(todayCounts(input).due).toBe(0);
    expect(isGoalReached(day, cards, [], settings())).toBe(true);
  });

  it('keine neue Umkehrkarte, wenn die Spanisch → Deutsch-Karte heute bewertet wurde oder fällig ist', () => {
    const W = words(2);
    const queued = [queuedReverse('w0001', at(2026, 9, 20)), queuedReverse('w0002', at(2026, 9, 20))];
    const rated = ratedToday(es('w0001', at(2026, 10, 9)));
    const dueToday = es('w0002', at(2026, 10, 1, 15));
    expect(availableReverseCards([...queued, rated, dueToday], W, TODAY)).toEqual([]);
    const later = es('w0002', at(2026, 10, 9), { last_review: at(2026, 9, 25) });
    expect(availableReverseCards([...queued, rated, later], W, TODAY).map((c) => c.id)).toEqual(['w0002:de-es']);
  });
});
