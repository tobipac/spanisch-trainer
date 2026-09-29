import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { now } from '../app/clock.ts';
import { BarChart } from '../components/BarChart.tsx';
import { ProblemIcon } from '../components/ProblemIcon.tsx';
import { MAX_COVERAGE } from '../config/coverage.ts';
import { BADGE_THRESHOLD, BANDS, FORECAST_DAYS, HISTORY_DAYS } from '../config/progress.ts';
import { WORD_BY_ID, WORDS } from '../data/words.ts';
import { db } from '../db/database.ts';
import { problemCards, wordIdOfCard } from '../domain/difficulty.ts';
import { dayStart, learningDayOf } from '../domain/learningDay.ts';
import {
  bandStats,
  coverage,
  dueForecast,
  reviewHistory,
  type BandStat,
  type DayValue,
} from '../domain/progress.ts';

interface ProgressState {
  bands: BandStat[];
  coverage: number;
  history: DayValue[];
  forecast: DayValue[];
  problems: Array<{ cardId: string; again: number }>;
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const date = (day: string) => dayStart(day);
const short = (day: string) => `${date(day).getDate()}.${date(day).getMonth() + 1}.`;
const long = (day: string) => `${WD[date(day).getDay()]} ${short(day)}`;
const fmt = (n: number) => n.toLocaleString('de-DE');

async function loadProgress(): Promise<ProgressState> {
  const today = learningDayOf(now());
  const [cards, days, logs] = await Promise.all([db.cards.toArray(), db.days.toArray(), db.reviewLogs.toArray()]);
  return {
    bands: bandStats(cards, WORDS, BANDS, BADGE_THRESHOLD),
    coverage: coverage(cards, WORDS),
    history: reviewHistory(days, today, HISTORY_DAYS),
    forecast: dueForecast(cards, today, FORECAST_DAYS),
    problems: problemCards(logs).filter((p) => WORD_BY_ID.has(wordIdOfCard(p.cardId))),
  };
}

function Band({ b }: { b: BandStat }) {
  const seenPct = (b.seen / b.size) * 100;
  const stablePct = (b.stable / b.size) * 100;
  return (
    <li className="rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          Wörter {fmt(b.from)}–{fmt(b.to)}
        </span>
        {b.badge ? (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white"
          >
            🏅 Abzeichen
          </motion.span>
        ) : (
          <span className="text-xs text-neutral-500">Abzeichen ab {Math.round(BADGE_THRESHOLD * 100)} %</span>
        )}
      </div>
      <div
        className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="img"
        aria-label={`${b.stable} gefestigt, ${b.seen} gesehen von ${b.size}`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent opacity-35" style={{ width: `${seenPct}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${stablePct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
        <span>
          <strong className="text-neutral-900 dark:text-neutral-100">{b.stable}</strong> gefestigt
        </span>
        <span>
          <strong className="text-neutral-900 dark:text-neutral-100">{b.seen}</strong> gesehen · {b.size} gesamt
        </span>
      </div>
    </li>
  );
}

/** Fortschritt-Screen (SPEC.md Abschnitt 5). */
export function ProgressScreen() {
  const [state, setState] = useState<ProgressState | null>(null);

  useEffect(() => {
    void loadProgress().then(setState);
  }, []);

  if (!state) return <div className="h-full" />;

  const covPct = Math.round(state.coverage * 100);
  const maxPct = Math.round(MAX_COVERAGE * 100);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pb-2">
      <header className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight">Fortschritt</h1>
      </header>

      <section aria-labelledby="cov">
        <h2 id="cov" className="sr-only">
          Abdeckung
        </h2>
        <p className="text-lg">
          Du kennst <strong className="text-3xl">ca. {covPct} %</strong> der Wörter in Alltag und Medien.
        </p>
        <div className="relative mt-3 h-3 rounded-full bg-neutral-200 dark:bg-neutral-800" role="img" aria-label={`ca. ${covPct} % von maximal ca. ${maxPct} %`}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${state.coverage * 100}%` }} />
          <div className="absolute -top-1 h-5 w-0.5 bg-neutral-900 dark:bg-neutral-100" style={{ left: `${MAX_COVERAGE * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          Der Strich markiert das Ziel: ca. {maxPct} %, wenn alle 1.500 Wörter gefestigt sind. Gefestigt heißt:
          Spanisch → Deutsch-Stabilität ab 21 Tagen.
        </p>
      </section>

      <section aria-labelledby="bands">
        <h2 id="bands" className="mb-2 font-semibold">
          Bänder
        </h2>
        <ul className="flex flex-col gap-2">
          {state.bands.map((b) => (
            <Band key={b.from} b={b} />
          ))}
        </ul>
      </section>

      <BarChart
        title="Letzte 30 Tage"
        data={state.history}
        unit="Bewertungen"
        axisLabel={short}
        longLabel={long}
        showAxisLabel={(i, n) => i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)}
      />

      <BarChart
        title="Fällig in den nächsten 7 Tagen"
        data={state.forecast}
        unit="Karten"
        axisLabel={(d) => WD[date(d).getDay()] ?? ''}
        longLabel={long}
        showAxisLabel={() => true}
        initialIndex={0}
      />

      {state.problems.length > 0 && (
        <section aria-labelledby="problems">
          <h2 id="problems" className="mb-2 flex items-center gap-1.5 font-semibold">
            <ProblemIcon /> Problemkarten
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-2xl bg-neutral-100 dark:divide-neutral-800 dark:bg-neutral-900">
            {state.problems.map((p) => {
              const w = WORD_BY_ID.get(wordIdOfCard(p.cardId))!;
              const reverse = p.cardId.endsWith(':de-es');
              return (
                <li key={p.cardId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <strong>{w.article ? `${w.article} ${w.es}` : w.es}</strong>
                    <span className="text-neutral-600 dark:text-neutral-400"> – {w.de}</span>
                    <span className="block text-xs text-neutral-500">{reverse ? 'Deutsch → Spanisch' : 'Spanisch → Deutsch'}</span>
                  </span>
                  <span className="shrink-0 text-sm text-neutral-600 dark:text-neutral-400" aria-label={`${p.again}-mal Nochmal`}>
                    {p.again}×
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
