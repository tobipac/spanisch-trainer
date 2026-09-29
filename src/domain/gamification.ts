// Streak, Joker, XP und Level (SPEC.md Abschnitt 7). Reine Logik, vollständig aus den Tagesdatensätzen abgeleitet –
// es gibt keinen gespeicherten Zähler, der auseinanderlaufen könnte.
import { LEVEL_XP_FACTOR, levelForXp } from '../config/learning.ts';
import { addDays, daysBetween, weekOf } from './learningDay.ts';
import type { DayRecord } from './types.ts';

export interface StreakInfo {
  /** Anzahl Tage mit erreichtem Tagesziel ohne Unterbrechung (heute zählt, sobald erreicht). */
  streak: number;
  /** Lerntage, die ein Joker gerettet hat (chronologisch). */
  jokerDays: string[];
  /** Ist der Joker dieser Kalenderwoche noch frei? */
  jokerAvailable: boolean;
  /** Joker, der in der aktuellen Woche eingesetzt wurde (für den Hinweis in der App). */
  jokerThisWeek: string | null;
}

/**
 * Regeln (SPEC V3):
 * - Tag mit erreichtem Tagesziel: Streak +1.
 * - Neutraler Tag: zählt nicht, unterbricht nicht.
 * - Verpasster Tag (Ziel nicht erreicht oder App nicht geöffnet): der Joker der Kalenderwoche (Mo 04:00 – Mo 04:00)
 *   rettet den ersten verpassten Tag, sofern ein Streak läuft; sonst Streak = 0. Ungenutzte Joker verfallen.
 * - Der laufende Tag unterbricht nie; er zählt, sobald das Ziel erreicht ist.
 */
export function computeStreak(days: readonly DayRecord[], today: string): StreakInfo {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const first = [...byDay.keys()].sort()[0];
  const usedWeeks = new Map<string, string>(); // Woche -> geretteter Tag
  let streak = 0;

  if (first !== undefined && first <= today) {
    for (let d = first; d < today; d = addDays(d, 1)) {
      const rec = byDay.get(d);
      if (rec?.goalReached) {
        streak += 1;
      } else if (rec?.neutral) {
        continue;
      } else {
        const week = weekOf(d);
        if (streak > 0 && !usedWeeks.has(week)) usedWeeks.set(week, d);
        else streak = 0;
      }
    }
    if (byDay.get(today)?.goalReached) streak += 1;
  }

  const thisWeek = weekOf(today);
  return {
    streak,
    jokerDays: [...usedWeeks.values()].sort(),
    jokerAvailable: !usedWeeks.has(thisWeek),
    jokerThisWeek: usedWeeks.get(thisWeek) ?? null,
  };
}

export interface LevelInfo {
  totalXp: number;
  level: number;
  /** XP-Schwelle des aktuellen und des nächsten Levels. */
  currentLevelXp: number;
  nextLevelXp: number;
}

/** Level aus den XP der Lerntage plus Trainings-XP der Extra-Übung (die nicht in den Tagen stehen). */
export function levelInfo(days: readonly DayRecord[], practiceXp = 0): LevelInfo {
  const totalXp = days.reduce((sum, d) => sum + d.xp, 0) + practiceXp;
  const level = levelForXp(totalXp);
  return {
    totalXp,
    level,
    currentLevelXp: LEVEL_XP_FACTOR * level * level,
    nextLevelXp: LEVEL_XP_FACTOR * (level + 1) * (level + 1),
  };
}

/** Backup-Hinweis: letztes Backup älter als maxDays, oder nie gesichert und die App wird seit maxDays genutzt. */
export function backupDue(
  lastBackupAt: number | undefined,
  firstDay: string | undefined,
  today: string,
  now: Date,
  maxDays: number,
): boolean {
  if (lastBackupAt !== undefined) return now.getTime() - lastBackupAt > maxDays * 86_400_000;
  return firstDay !== undefined && daysBetween(firstDay, today) >= maxDays;
}
