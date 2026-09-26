import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { formatInterval, isStable, newFsrsCard, previewDue, rateCard } from '../src/domain/scheduler.ts';
import { at, reviewCard } from './helpers.ts';

const minutes = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60_000);

describe('FSRS-Anbindung', () => {
  const now = at(2026, 9, 26, 10);

  it('Lernschritte 1 min und 10 min', () => {
    const card = newFsrsCard(now);
    expect(minutes(now, rateCard(card, 1, now).card.due)).toBe(1);
    const good = rateCard(card, 3, now).card;
    expect(minutes(now, good.due)).toBe(10);
    expect(good.state).toBe(State.Learning);
    // zweiter Schritt mit „Gut“ → Wiederholungsphase, mindestens 1 Tag
    const graduated = rateCard(good, 3, new Date(good.due)).card;
    expect(graduated.state).toBe(State.Review);
    expect(graduated.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it('Vorschau liefert 4 aufsteigende Fälligkeiten', () => {
    const p = previewDue(reviewCard('w0001', now).fsrs, now);
    expect(p[1].getTime()).toBeLessThan(p[2].getTime());
    expect(p[2].getTime()).toBeLessThanOrEqual(p[3].getTime());
    expect(p[3].getTime()).toBeLessThanOrEqual(p[4].getTime());
  });

  it('maximales Intervall 365 Tage', () => {
    const card = reviewCard('w0001', now, { stability: 5000, scheduled_days: 300 }).fsrs;
    expect(rateCard(card, 4, now).card.scheduled_days).toBeLessThanOrEqual(365);
  });

  it('gefestigt ab stability 21 Tage', () => {
    expect(isStable(reviewCard('w', now, { stability: 20.9 }).fsrs)).toBe(false);
    expect(isStable(reviewCard('w', now, { stability: 21 }).fsrs)).toBe(true);
  });

  it('Intervall-Kurzform für die Buttons', () => {
    expect(formatInterval(now, new Date(now.getTime() + 60_000))).toBe('1 min');
    expect(formatInterval(now, new Date(now.getTime() + 10 * 60_000))).toBe('10 min');
    expect(formatInterval(now, new Date(now.getTime() + 3 * 86_400_000))).toBe('3 T');
    expect(formatInterval(now, new Date(now.getTime() + 60 * 86_400_000))).toBe('2 Mon');
  });
});
