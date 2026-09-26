// Dünne Hülle um ts-fsrs. Der Algorithmus selbst wird nicht nachgebaut.
import { createEmptyCard, fsrs, type Card, type Grade, type ReviewLog } from 'ts-fsrs';
import { FSRS_PARAMS, STABLE_MIN_STABILITY_DAYS } from '../config/learning.ts';
import type { Rating } from './types.ts';

const scheduler = fsrs(FSRS_PARAMS);

export function newFsrsCard(now: Date): Card {
  return createEmptyCard(now);
}

export function rateCard(card: Card, rating: Rating, now: Date): { card: Card; log: ReviewLog } {
  return scheduler.next(card, now, rating as Grade);
}

/** Vorschau: nächster Fälligkeitszeitpunkt je Bewertung (für die Buttons). */
export function previewDue(card: Card, now: Date): Record<Rating, Date> {
  const p = scheduler.repeat(card, now);
  return { 1: p[1].card.due, 2: p[2].card.due, 3: p[3].card.due, 4: p[4].card.due };
}

/** Kurzform für die Button-Beschriftung, z. B. "1 min", "10 min", "3 T", "2 Mon". */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(minutes / 1440);
  if (days < 31) return `${days} T`;
  if (days < 365) return `${Math.round(days / 30)} Mon`;
  return `${Math.round((days / 365) * 10) / 10} J`.replace('.', ',');
}

/** Gefestigt = FSRS-stability ≥ 21 Tage (SPEC.md Abschnitt 5 / 7). */
export function isStable(card: Card): boolean {
  return card.stability >= STABLE_MIN_STABILITY_DAYS;
}
