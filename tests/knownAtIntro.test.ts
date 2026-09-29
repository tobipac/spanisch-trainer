import { describe, expect, it } from 'vitest';
import { Rating as FsrsRating, State } from 'ts-fsrs';
import { addDays } from '../src/domain/learningDay.ts';
import { applyRating, type NextCard } from '../src/domain/session.ts';
import { at, settings, Sim, words } from './helpers.ts';

const NOW = at(2026, 10, 1, 10);

describe('„Kenne ich schon“', () => {
  it('FSRS-Bewertung „Leicht“, dauerhaft markiert, zählt nicht zum Limit neuer Wörter', () => {
    const sim = new Sim(words(5), settings({ newPerDay: 2 }));
    const first = sim.next(NOW)!;
    expect(first.kind).toBe('new');
    const r = applyRating({ now: NOW, next: first, rating: 3, knownAtIntro: true, day: sim.day(NOW), cards: sim.cards, words: sim.words, settings: sim.settings, session: sim.session });
    expect(r.log.log.rating).toBe(FsrsRating.Easy);
    expect(r.log.rating).toBe(4);
    expect(r.card.knownAtIntro).toBe(true);
    expect(r.card.fsrs.state).toBe(State.Review);
    expect(r.day.newDone).toBe(0);
    expect(r.xpGained).toBe(0);
  });

  it('Limit bleibt voll nutzbar: bei Limit 2 kommen trotzdem 2 weitere neue Wörter', () => {
    const sim = new Sim(words(5), settings({ newPerDay: 2 }));
    const first = sim.next(NOW)!;
    sim.rate(NOW, first, 4); // normal bewertet, zählt
    const second = sim.next(NOW)!;
    const r = applyRating({ now: NOW, next: second, rating: 4, knownAtIntro: true, day: sim.day(NOW), cards: sim.cards, words: sim.words, settings: sim.settings, session: sim.session });
    sim.cards = [...sim.cards.filter((c) => c.id !== r.card.id), r.card];
    sim.days.set(r.day.day, r.day);
    sim.session = r.session;
    const third = sim.next(NOW)!;
    expect(third.kind).toBe('new');
    expect(third.card.wordId).toBe('w0003');
  });

  it('bekommt nie eine Umkehrkarte – auch nicht bei späteren langen Intervallen', () => {
    const sim = new Sim(words(1), settings({ newPerDay: 1 }));
    const first = sim.next(NOW)!;
    const r = applyRating({ now: NOW, next: first, rating: 4, knownAtIntro: true, day: sim.day(NOW), cards: sim.cards, words: sim.words, settings: sim.settings, session: sim.session });
    expect(r.createdReverse).toBeNull();
    sim.cards = [r.card];
    sim.days.set(r.day.day, r.day);
    // spätere Wiederholungen mit „Gut“ über viele Tage
    let day = '2026-10-01';
    for (let i = 0; i < 6; i++) {
      const due = new Date(sim.cards[0]!.fsrs.due);
      day = addDays(day, 1);
      const when = due.getTime() > at(2026, 10, 1).getTime() ? new Date(due.getTime() + 3_600_000) : at(2026, 10, 2, 10);
      const n = sim.next(when);
      if (!n) continue;
      const res = sim.rate(when, n, 3);
      expect(res.createdReverse).toBeNull();
    }
    expect(sim.cards.some((c) => c.direction === 'de-es')).toBe(false);
  });

  it('nur bei der ersten Ansicht eines neuen Wortes erlaubt', () => {
    const sim = new Sim(words(1), settings({ newPerDay: 1 }));
    const first = sim.next(NOW)!;
    sim.rate(NOW, first, 1); // Nochmal → Lernschritt
    const again: NextCard = { kind: 'learning', card: sim.cards[0]! };
    expect(() =>
      applyRating({ now: NOW, next: again, rating: 4, knownAtIntro: true, day: sim.day(NOW), cards: sim.cards, words: sim.words, settings: sim.settings, session: sim.session }),
    ).toThrow();
  });
});
