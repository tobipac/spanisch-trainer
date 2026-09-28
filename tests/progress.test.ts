import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BAND_COVERAGE, MAX_COVERAGE } from '../src/config/coverage.ts';
import { BADGE_THRESHOLD, BANDS } from '../src/config/progress.ts';
import { bandStats, coverage, dueForecast, reviewHistory, stableWordCount, type WordShare } from '../src/domain/progress.ts';
import type { DayRecord } from '../src/domain/types.ts';
import { parseRanking } from '../scripts/lib/word-checks.ts';
import { at, learningCard, queuedReverse, reviewCard } from './helpers.ts';

const W: WordShare[] = Array.from({ length: 300 }, (_, i) => ({
  id: `w${String(i + 1).padStart(4, '0')}`,
  rank: i + 1,
  freqShare: 0.001,
}));

const stable = (id: string) => reviewCard(id, at(2026, 11, 1), { stability: 30 });
const young = (id: string) => reviewCard(id, at(2026, 11, 1), { stability: 5 });

describe('Bänder', () => {
  it('gesehen und gefestigt je Band, nur Spanisch → Deutsch zählt', () => {
    const cards = [stable('w0001'), young('w0002'), stable('w0150'), reviewCard('w0003', at(2026, 11, 1), { stability: 30 }, 'de-es')];
    const s = bandStats(cards, W, BANDS, BADGE_THRESHOLD);
    expect(s[0]).toMatchObject({ from: 1, to: 100, size: 100, seen: 2, stable: 1, badge: false });
    expect(s[1]).toMatchObject({ from: 101, to: 250, size: 150, seen: 1, stable: 1 });
    expect(s[4]).toMatchObject({ size: 500, seen: 0, stable: 0 });
  });

  it('Abzeichen ab 90 % gefestigt, bezogen auf die Bandgröße', () => {
    const cards89 = Array.from({ length: 89 }, (_, i) => stable(`w${String(i + 1).padStart(4, '0')}`));
    expect(bandStats(cards89, W, BANDS, BADGE_THRESHOLD)[0]!.badge).toBe(false);
    const cards90 = [...cards89, stable('w0090')];
    expect(bandStats(cards90, W, BANDS, BADGE_THRESHOLD)[0]!.badge).toBe(true);
  });

  it('nicht eingeführte Karten (Warteschlange) zählen nicht als gesehen', () => {
    expect(bandStats([queuedReverse('w0001', at(2026, 10, 1))], W, BANDS, BADGE_THRESHOLD)[0]!.seen).toBe(0);
  });
});

describe('Abdeckung', () => {
  it('Summe freqShare der gefestigten Wörter', () => {
    const cards = [stable('w0001'), stable('w0002'), young('w0003')];
    expect(coverage(cards, W)).toBeCloseTo(0.002);
  });

  it('zählt gefestigte Wörter (nur Spanisch → Deutsch, eingeführt, stability ≥ 21 Tage)', () => {
    const cards = [stable('w0001'), stable('w0002'), young('w0003'), queuedReverse('w0004', at(2026, 10, 1))];
    expect(stableWordCount(cards)).toBe(2);
  });

  it('Abdeckungstabelle stimmt mit der Rangliste überein (sonst: npm run build:coverage)', () => {
    const rows = parseRanking(readFileSync(new URL('../data/ranking/lemma-ranking.csv', import.meta.url), 'utf-8'));
    const sum = (a: number, b: number) => rows.filter((r) => r.rank >= a && r.rank <= b).reduce((s, r) => s + r.freqShare, 0);
    expect(MAX_COVERAGE).toBeCloseTo(sum(1, 1500), 6);
    BANDS.forEach(([a, b], i) => expect(BAND_COVERAGE[i]).toBeCloseTo(sum(a, b), 6));
  });
});

describe('Verlauf und Vorschau', () => {
  const rec = (day: string, n: number): DayRecord => ({
    day, newDone: n, reverseDone: 1, reviewsDone: 2, goalReached: true, neutral: false, jokerUsed: false, xp: 0, dueAtStartIds: [],
  });

  it('Verlauf: n Lerntage bis heute, fehlende Tage = 0', () => {
    const h = reviewHistory([rec('2026-10-08', 5), rec('2026-10-10', 1)], '2026-10-10', 4);
    expect(h).toEqual([
      { day: '2026-10-07', value: 0 },
      { day: '2026-10-08', value: 8 },
      { day: '2026-10-09', value: 0 },
      { day: '2026-10-10', value: 4 },
    ]);
  });

  it('Vorschau: überfällige zählen zu heute, Lerntag-Grenze 04:00, Warteschlange zählt nicht', () => {
    const cards = [
      reviewCard('a', at(2026, 10, 1, 9)), // überfällig
      reviewCard('b', at(2026, 10, 10, 20)), // heute
      reviewCard('c', at(2026, 10, 11, 3, 30)), // 03:30 → noch heute
      reviewCard('d', at(2026, 10, 11, 4, 0)), // morgen
      learningCard('e', at(2026, 10, 12, 9)), // übermorgen
      reviewCard('f', at(2026, 10, 20, 9)), // außerhalb
      queuedReverse('g', at(2026, 10, 9)),
    ];
    expect(dueForecast(cards, '2026-10-10', 3).map((d) => d.value)).toEqual([3, 1, 1]);
  });
});
