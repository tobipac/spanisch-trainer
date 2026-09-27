import { useCallback, useEffect, useState } from 'react';
import { now } from '../app/clock.ts';
import { logError } from '../app/errorLog.ts';
import { unlockAudio } from '../audio/speech.ts';
import { DayRing } from '../components/DayRing.tsx';
import { APP_NAME } from '../config/app.ts';
import { BACKUP_REMINDER_DAYS, SECONDS_PER_CARD, THROTTLE_HALF_ABOVE, THROTTLE_ZERO_ABOVE } from '../config/learning.ts';
import { WORD_REFS } from '../data/words.ts';
import { db } from '../db/database.ts';
import { getOrCreateDay, loadSettings } from '../db/repository.ts';
import { backupDue, computeStreak, levelInfo, type LevelInfo, type StreakInfo } from '../domain/gamification.ts';
import { dayEnd, dayStart } from '../domain/learningDay.ts';
import {
  dayLimits,
  goalProgress,
  reverseQueueHint,
  todayCounts,
  type DayLimits,
  type TodayCounts,
} from '../domain/session.ts';
import type { DayRecord } from '../domain/types.ts';

interface Props {
  onStart: () => void;
}

interface HomeState {
  day: DayRecord;
  counts: TodayCounts;
  progress: { done: number; total: number };
  limits: DayLimits;
  streak: StreakInfo;
  level: LevelInfo;
  reverseHint: boolean;
  backupHint: boolean;
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const weekday = (day: string) => WEEKDAYS[dayStart(day).getDay()] ?? day;

async function loadHome(): Promise<HomeState> {
  const t = now();
  const day = await getOrCreateDay(db, t, WORD_REFS);
  const [cards, settings, days] = await Promise.all([db.cards.toArray(), loadSettings(db), db.days.toArray()]);
  const input = { day, cards, words: WORD_REFS, settings };
  const counts = todayCounts(input);
  const firstDay = days.map((d) => d.day).sort()[0];
  return {
    day,
    counts,
    progress: goalProgress(day, cards, WORD_REFS, settings),
    limits: dayLimits(day, cards, WORD_REFS, settings),
    streak: computeStreak(days, day.day),
    level: levelInfo(days),
    reverseHint: reverseQueueHint(counts.reverseQueued, settings),
    backupHint: backupDue(settings.lastBackupAt, firstDay, day.day, t, BACKUP_REMINDER_DAYS),
  };
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-neutral-100 px-2 py-3 dark:bg-neutral-900">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">{children}</p>;
}

/** Heute-Screen (SPEC.md Abschnitt 5). */
export function HomeScreen({ onStart }: Props) {
  const [state, setState] = useState<HomeState | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    loadHome()
      .then((s) => {
        setState(s);
        setFailed(false);
      })
      .catch((e: unknown) => {
        logError(e, 'Heute laden');
        setFailed(true);
      });
  }, []);

  // Bleibt die App über 04:00 geöffnet, zum neuen Lerntag automatisch neu laden.
  useEffect(() => {
    if (!state) return;
    const ms = dayEnd(state.day.day).getTime() - now().getTime() + 1000;
    const timer = setTimeout(refresh, Math.max(1000, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(timer);
  }, [state, refresh]);

  useEffect(() => {
    refresh();
    // Nach dem Zurückkehren in die App neu laden (z. B. neuer Lerntag nach 04:00).
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p>Deine Daten konnten nicht geladen werden.</p>
        <button type="button" onClick={refresh} className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-white">
          Erneut versuchen
        </button>
      </div>
    );
  }
  if (!state) return <div className="h-full" />;

  const { day, counts, progress, limits, streak, level } = state;
  const remaining = counts.due + counts.newLeft + counts.reverseLeft;
  const minutes = Math.ceil((remaining * SECONDS_PER_CARD) / 60);
  const levelRatio = (level.totalXp - level.currentLevelXp) / (level.nextLevelXp - level.currentLevelXp);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Heute</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-900" aria-label={`Streak ${streak.streak} Tage`}>
          <span aria-hidden="true">🔥</span>
          <span className="text-lg font-bold">{streak.streak}</span>
          <span className="text-xs text-neutral-500">{streak.jokerAvailable ? '· 🃏' : ''}</span>
        </div>
      </header>

      <section className="flex flex-col items-center gap-4 py-2">
        <DayRing done={progress.done} total={progress.total} reached={day.goalReached} />
        <div className="grid w-full grid-cols-3 gap-2">
          <Stat value={counts.due} label="fällig heute" />
          <Stat value={counts.newLeft} label="neu heute" />
          <Stat value={remaining === 0 ? '–' : `ca. ${minutes}`} label="Minuten" />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        {limits.throttle === 'half' && (
          <Notice>
            Viele Wiederholungen fällig (über {THROTTLE_HALF_ABOVE}) – heute nur {limits.newLimit} neue Wörter, damit du
            nicht ins Hintertreffen gerätst.
          </Notice>
        )}
        {limits.throttle === 'zero' && (
          <Notice>
            Über {THROTTLE_ZERO_ABOVE} Wiederholungen fällig – heute keine neuen Wörter. Erst den Rückstand abbauen.
          </Notice>
        )}
        {day.neutral && <Notice>Heute gibt es nichts zu tun. Der Tag zählt nicht und unterbricht deinen Streak nicht.</Notice>}
        {streak.jokerThisWeek && (
          <Notice>🃏 Joker für {weekday(streak.jokerThisWeek)} eingesetzt – dein Streak bleibt erhalten.</Notice>
        )}
        {!streak.jokerThisWeek && streak.jokerAvailable && streak.streak > 0 && (
          <p className="px-1 text-sm text-neutral-500 dark:text-neutral-400">🃏 Joker diese Woche verfügbar: rettet einen verpassten Tag.</p>
        )}
        <p className="px-1 text-sm text-neutral-600 dark:text-neutral-400">
          Umkehrkarten offen: <strong>{counts.reverseQueued}</strong>
          {state.reverseHint && ' – die Warteschlange wächst. Ein paar Tage nur Umkehrkarten helfen beim Abbau.'}
        </p>
        {state.backupHint && (
          <Notice>💾 Letztes Backup ist über {BACKUP_REMINDER_DAYS} Tage her. Sichern unter Einstellungen → Backup.</Notice>
        )}
      </section>

      <section className="px-1">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">Level {level.level}</span>
          <span className="text-neutral-500">
            {level.totalXp} / {level.nextLevelXp} XP
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(levelRatio * 100)}%` }} />
        </div>
      </section>

      <div className="mt-auto pt-2 pb-6">
        <button
          type="button"
          onClick={() => {
            unlockAudio(); // iOS: Audio nur nach einer Nutzerberührung
            onStart();
          }}
          disabled={remaining === 0}
          className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95 disabled:bg-neutral-200 disabled:text-neutral-500 dark:disabled:bg-neutral-800"
        >
          {remaining === 0 ? 'Für heute alles erledigt' : 'Lernen starten'}
        </button>
      </div>
    </div>
  );
}
