import { describe, expect, it } from 'vitest';
import { addDays, dayEnd, dayStart, daysBetween, learningDayOf, weekOf } from '../src/domain/learningDay.ts';
import { at } from './helpers.ts';

describe('Lerntag (Wechsel um 04:00)', () => {
  it('läuft in der Zeitzone Europe/Vienna', () => {
    expect(at(2026, 1, 15).getTimezoneOffset()).toBe(-60);
    expect(at(2026, 7, 15).getTimezoneOffset()).toBe(-120);
  });

  it('03:59 gehört noch zum Vortag, 04:00 zum neuen Tag', () => {
    expect(learningDayOf(at(2026, 9, 26, 3, 59))).toBe('2026-09-25');
    expect(learningDayOf(at(2026, 9, 26, 4, 0))).toBe('2026-09-26');
    expect(learningDayOf(at(2026, 9, 26, 23, 59))).toBe('2026-09-26');
    expect(learningDayOf(at(2026, 9, 27, 0, 30))).toBe('2026-09-26');
  });

  it('Jahres- und Monatswechsel', () => {
    expect(learningDayOf(at(2027, 1, 1, 2))).toBe('2026-12-31');
    expect(learningDayOf(at(2026, 3, 1, 3))).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('Beginn und Ende des Lerntags liegen um 04:00', () => {
    expect(dayStart('2026-09-26')).toEqual(at(2026, 9, 26, 4));
    expect(dayEnd('2026-09-26')).toEqual(at(2026, 9, 27, 4));
  });

  it('Sommerzeit: Lerntage über die Umstellung haben 23 bzw. 25 Stunden', () => {
    const hours = (d: string) => (dayEnd(d).getTime() - dayStart(d).getTime()) / 3_600_000;
    expect(hours('2026-03-28')).toBe(23); // Umstellung 29.03. 02:00 → 03:00
    expect(hours('2026-10-24')).toBe(25); // Umstellung 25.10. 03:00 → 02:00
    expect(learningDayOf(at(2026, 3, 29, 3, 30))).toBe('2026-03-28');
    expect(learningDayOf(at(2026, 10, 25, 2, 30))).toBe('2026-10-24');
  });

  it('daysBetween zählt Lerntage', () => {
    expect(daysBetween('2026-09-26', '2026-09-26')).toBe(0);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-09-26', '2026-09-25')).toBe(-1);
  });

  it('Kalenderwoche Montag bis Sonntag, Beginn Montag 04:00', () => {
    expect(weekOf('2026-09-28')).toBe('2026-09-28'); // Montag
    expect(weekOf('2026-10-04')).toBe('2026-09-28'); // Sonntag
    // Montag 03:30 gehört noch zum Sonntag und damit zur alten Woche
    expect(weekOf(learningDayOf(at(2026, 9, 28, 3, 30)))).toBe('2026-09-21');
    expect(weekOf(learningDayOf(at(2026, 9, 28, 4, 0)))).toBe('2026-09-28');
  });
});
