import { describe, expect, it } from 'vitest';
import { backupDue, computeStreak, levelInfo } from '../src/domain/gamification.ts';
import { addDays } from '../src/domain/learningDay.ts';
import type { DayRecord } from '../src/domain/types.ts';
import { at } from './helpers.ts';

// 2026-09-28 ist ein Montag.
const MON = '2026-09-28';
const d = (offset: number) => addDays(MON, offset);

const rec = (day: string, over: Partial<DayRecord> = {}): DayRecord => ({
  day,
  newDone: 0,
  reverseDone: 0,
  reviewsDone: 0,
  goalReached: true,
  neutral: false,
  jokerUsed: false,
  xp: 10,
  dueAtStartIds: [],
  ...over,
});
const missed = (day: string) => rec(day, { goalReached: false });
const neutral = (day: string) => rec(day, { goalReached: false, neutral: true });

describe('Streak', () => {
  it('ohne Daten 0, Joker frei', () => {
    expect(computeStreak([], MON)).toEqual({ streak: 0, jokerDays: [], jokerAvailable: true, jokerThisWeek: null });
  });

  it('zählt aufeinanderfolgende Tage mit erreichtem Tagesziel', () => {
    const days = [rec(d(0)), rec(d(1)), rec(d(2))];
    expect(computeStreak(days, d(2)).streak).toBe(3);
  });

  it('der laufende Tag unterbricht nicht und zählt erst mit erreichtem Ziel', () => {
    const days = [rec(d(0)), rec(d(1)), missed(d(2))];
    expect(computeStreak(days, d(2)).streak).toBe(2);
    expect(computeStreak([rec(d(0)), rec(d(1))], d(2)).streak).toBe(2); // heute noch nicht geöffnet
  });

  it('neutraler Tag zählt nicht und unterbricht nicht', () => {
    const days = [rec(d(0)), neutral(d(1)), rec(d(2))];
    const s = computeStreak(days, d(2));
    expect(s.streak).toBe(2);
    expect(s.jokerDays).toEqual([]);
  });

  it('Joker rettet den ersten verpassten Tag der Woche', () => {
    const days = [rec(d(0)), missed(d(1)), rec(d(2))];
    const s = computeStreak(days, d(2));
    expect(s.streak).toBe(2);
    expect(s.jokerDays).toEqual([d(1)]);
    expect(s.jokerAvailable).toBe(false);
    expect(s.jokerThisWeek).toBe(d(1));
  });

  it('nicht geöffneter Tag gilt als verpasst und wird vom Joker gerettet', () => {
    const days = [rec(d(0)), rec(d(2))];
    const s = computeStreak(days, d(2));
    expect(s.streak).toBe(2);
    expect(s.jokerDays).toEqual([d(1)]);
  });

  it('zweiter verpasster Tag in derselben Woche setzt den Streak auf 0', () => {
    const days = [rec(d(0)), missed(d(1)), missed(d(2)), rec(d(3))];
    const s = computeStreak(days, d(3));
    expect(s.streak).toBe(1);
    expect(s.jokerDays).toEqual([d(1)]);
  });

  it('bei Streak 0 wird kein Joker verbraucht', () => {
    const days = [missed(d(0)), rec(d(1))];
    const s = computeStreak(days, d(1));
    expect(s.streak).toBe(1);
    expect(s.jokerDays).toEqual([]);
    expect(s.jokerAvailable).toBe(true);
  });

  it('jede Kalenderwoche (Mo–So) hat einen eigenen Joker, ungenutzte verfallen', () => {
    // Woche 1: So verpasst (Joker 1), Woche 2: Mo verpasst (Joker 2)
    const days = [rec(d(0)), rec(d(1)), rec(d(2)), rec(d(3)), rec(d(4)), rec(d(5)), missed(d(6)), missed(d(7)), rec(d(8))];
    const s = computeStreak(days, d(8));
    expect(s.jokerDays).toEqual([d(6), d(7)]);
    expect(s.streak).toBe(7);
    expect(s.jokerAvailable).toBe(false);
  });

  it('ein in der Vorwoche nicht genutzter Joker lässt sich nicht aufsparen', () => {
    // Woche 1 komplett, Woche 2: Mo und Di verpasst → nur ein Joker
    const days = [...Array.from({ length: 7 }, (_, i) => rec(d(i))), missed(d(7)), missed(d(8)), rec(d(9))];
    expect(computeStreak(days, d(9)).streak).toBe(1);
  });

  it('der Joker der neuen Woche ist ab dem Lerntag Montag verfügbar', () => {
    const days = [rec(d(-2)), missed(d(-1))]; // Sa, So der Vorwoche; So vom Joker gerettet
    expect(computeStreak(days, d(-1)).jokerAvailable).toBe(true); // heute So: noch nichts verbraucht (heute zählt nicht)
    expect(computeStreak(days, d(0)).jokerAvailable).toBe(true); // Montag: neuer Joker
    expect(computeStreak(days, d(0)).jokerDays).toEqual([d(-1)]);
  });
});

describe('XP und Level', () => {
  it('Summe aller Tage, Level n ab 50·n²', () => {
    expect(levelInfo([])).toEqual({ totalXp: 0, level: 0, currentLevelXp: 0, nextLevelXp: 50 });
    expect(levelInfo([rec(d(0), { xp: 30 }), rec(d(1), { xp: 20 })])).toMatchObject({ totalXp: 50, level: 1, nextLevelXp: 200 });
    expect(levelInfo([rec(d(0), { xp: 449 })]).level).toBe(2);
    expect(levelInfo([rec(d(0), { xp: 450 })]).level).toBe(3);
  });
});

describe('Backup-Hinweis', () => {
  const now = at(2026, 10, 10, 12);
  it('letztes Backup älter als 7 Tage', () => {
    expect(backupDue(at(2026, 10, 2, 12).getTime(), d(0), '2026-10-10', now, 7)).toBe(true);
    expect(backupDue(at(2026, 10, 4, 12).getTime(), d(0), '2026-10-10', now, 7)).toBe(false);
  });
  it('nie gesichert: erst nach 7 Tagen Nutzung', () => {
    expect(backupDue(undefined, '2026-10-05', '2026-10-10', now, 7)).toBe(false);
    expect(backupDue(undefined, '2026-10-03', '2026-10-10', now, 7)).toBe(true);
    expect(backupDue(undefined, undefined, '2026-10-10', now, 7)).toBe(false);
  });
});
