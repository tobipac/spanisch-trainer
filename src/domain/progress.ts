// Kennzahlen für den Fortschritt-Screen (SPEC.md Abschnitt 5 und 7). Reine Logik, getestet.
import { addDays, dayEnd, learningDayOf } from './learningDay.ts';
import { isStable } from './scheduler.ts';
import type { CardRecord, DayRecord, Word } from './types.ts';

export type WordShare = Pick<Word, 'id' | 'rank' | 'freqShare'>;

export interface BandStat {
  from: number;
  to: number;
  size: number;
  seen: number;
  stable: number;
  badge: boolean;
}

/** Spanisch → Deutsch-Karten nach Wort-ID. */
function esDeCards(cards: readonly CardRecord[]): Map<string, CardRecord> {
  return new Map(cards.filter((c) => c.direction === 'es-de' && c.introducedAt !== null).map((c) => [c.wordId, c]));
}

/** Je Band: gesehen (eingeführt), gefestigt (stability ≥ 21 Tage), Abzeichen ab Schwelle. */
export function bandStats(
  cards: readonly CardRecord[],
  words: readonly WordShare[],
  bands: ReadonlyArray<readonly [number, number]>,
  badgeThreshold: number,
): BandStat[] {
  const byWord = esDeCards(cards);
  return bands.map(([from, to]) => {
    const inBand = words.filter((w) => w.rank >= from && w.rank <= to);
    const seen = inBand.filter((w) => byWord.has(w.id)).length;
    const stable = inBand.filter((w) => {
      const c = byWord.get(w.id);
      return c !== undefined && isStable(c.fsrs);
    }).length;
    const size = to - from + 1;
    return { from, to, size, seen, stable, badge: stable >= badgeThreshold * size };
  });
}

/** Abdeckung = Summe freqShare aller gefestigten Wörter (SPEC.md Abschnitt 7). */
export function coverage(cards: readonly CardRecord[], words: readonly WordShare[]): number {
  const byWord = esDeCards(cards);
  return words.reduce((sum, w) => {
    const c = byWord.get(w.id);
    return c !== undefined && isStable(c.fsrs) ? sum + w.freqShare : sum;
  }, 0);
}

export interface DayValue {
  day: string;
  value: number;
}

/** Bewertungen pro Lerntag für die letzten n Lerntage bis einschließlich heute (fehlende Tage = 0). */
export function reviewHistory(days: readonly DayRecord[], today: string, n: number): DayValue[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    const d = byDay.get(day);
    return { day, value: d ? d.newDone + d.reverseDone + d.reviewsDone : 0 };
  });
}

/** Fällige Karten je Lerntag für heute und die folgenden Tage. Überfällige zählen zu heute. */
export function dueForecast(cards: readonly CardRecord[], today: string, n: number): DayValue[] {
  const result = Array.from({ length: n }, (_, i) => ({ day: addDays(today, i), value: 0 }));
  const lastEnd = dayEnd(addDays(today, n - 1)).getTime();
  for (const c of cards) {
    if (c.introducedAt === null) continue;
    const due = new Date(c.fsrs.due);
    if (due.getTime() >= lastEnd) continue;
    const day = learningDayOf(due);
    const idx = day <= today ? 0 : result.findIndex((r) => r.day === day);
    if (idx >= 0) result[idx]!.value += 1;
  }
  return result;
}
