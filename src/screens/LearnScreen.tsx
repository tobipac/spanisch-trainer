import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { now as clockNow } from '../app/clock.ts';
import { logError } from '../app/errorLog.ts';
import { speak } from '../audio/speech.ts';
import { Flashcard } from '../components/Flashcard.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { RatingButtons } from '../components/RatingButtons.tsx';
import { SessionSummary } from '../components/SessionSummary.tsx';
import { WORD_BY_ID, WORD_REFS } from '../data/words.ts';
import { db } from '../db/database.ts';
import { getOrCreateDay, loadSettings, rate, undo, type UndoToken } from '../db/repository.ts';
import { computeStreak } from '../domain/gamification.ts';
import { formatInterval, previewDue } from '../domain/scheduler.ts';
import { newSession, nextCard, remainingToday, type NextCard, type SessionState } from '../domain/session.ts';
import type { DayRecord, Rating, Settings } from '../domain/types.ts';

interface Props {
  onExit: () => void;
}

interface LastRating {
  token: UndoToken;
  card: NextCard;
  xp: number;
}

export function LearnScreen({ onExit }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [day, setDay] = useState<DayRecord | null>(null);
  const [current, setCurrent] = useState<NextCard | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [done, setDone] = useState(0);
  const [xp, setXp] = useState(0);
  const [last, setLast] = useState<LastRating | null>(null);
  const [streak, setStreak] = useState(0);
  const session = useRef<SessionState>(newSession());
  const cardKey = useRef(0);

  /** Nächste Karte aus dem aktuellen Stand der Datenbank bestimmen. */
  const advance = useCallback(async () => {
    const now = clockNow();
    const [d, cards, s] = await Promise.all([getOrCreateDay(db, now, WORD_REFS), db.cards.toArray(), loadSettings(db)]);
    const input = { now, day: d, cards, words: WORD_REFS, settings: s, session: session.current };
    const next = nextCard(input);
    setSettings(s);
    setDay(d);
    setRemaining(remainingToday(input));
    cardKey.current += 1;
    setRevealed(false);
    setCurrent(next);
    setFinished(next === null);
    if (next === null) setStreak(computeStreak(await db.days.toArray(), d.day).streak);
  }, []);

  useEffect(() => {
    advance().catch((e: unknown) => logError(e, 'Karte laden'));
  }, [advance]);

  const word = current ? WORD_BY_ID.get(current.card.wordId) : undefined;

  const say = useCallback(
    (text: string) => settings && speak(text, { rate: settings.speechRate, voiceURI: settings.voiceURI }),
    [settings],
  );

  // Automatisch vorlesen: Spanisch → Deutsch auf der Vorderseite, Deutsch → Spanisch nach dem Aufdecken.
  useEffect(() => {
    if (!settings?.autoPlayAudio || !current || !word) return;
    if (current.card.direction === 'es-de' && !revealed) say(word.article ? `${word.article} ${word.es}` : word.es);
    if (current.card.direction === 'de-es' && revealed) say(word.article ? `${word.article} ${word.es}` : word.es);
  }, [current, revealed, word, settings, say]);

  const intervals = useMemo(() => {
    if (!current) return { 1: '', 2: '', 3: '', 4: '' };
    const now = clockNow();
    const due = previewDue(current.card.fsrs, now);
    return {
      1: formatInterval(now, due[1]),
      2: formatInterval(now, due[2]),
      3: formatInterval(now, due[3]),
      4: formatInterval(now, due[4]),
    };
  }, [current]);

  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!current || busy || !revealed) return;
      setBusy(true);
      try {
        const { result, undo: token } = await rate(db, {
          now: clockNow(),
          next: current,
          rating,
          words: WORD_REFS,
          session: session.current,
        });
        session.current = result.session;
        setLast({ token, card: current, xp: result.xpGained });
        setDone((n) => n + 1);
        setXp((n) => n + result.xpGained);
        await advance();
      } catch (e) {
        logError(e, 'Bewerten');
      } finally {
        setBusy(false);
      }
    },
    [current, busy, revealed, advance],
  );

  const handleUndo = useCallback(async () => {
    if (!last || busy) return;
    setBusy(true);
    try {
      session.current = await undo(db, last.token);
      setDone((n) => n - 1);
      setXp((n) => n - last.xp);
      setDay(await getOrCreateDay(db, clockNow(), WORD_REFS));
      cardKey.current += 1;
      setCurrent(last.card); // dieselbe Karte im Zustand vor der Bewertung, aufgedeckt
      setRevealed(true);
      setFinished(false);
      setLast(null);
    } finally {
      setBusy(false);
    }
  }, [last, busy]);

  // Tastatur (Desktop): Leertaste deckt auf, 1–4 bewertet, Backspace = Rückgängig.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (['1', '2', '3', '4'].includes(e.key)) void handleRate(Number(e.key) as Rating);
      else if (e.key === 'Backspace') void handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, handleRate, handleUndo]);

  if (finished) {
    return (
      <div className="flex h-full flex-col">
        <SessionSummary cards={done} xp={xp} streak={streak} goalReached={day?.goalReached ?? false} onClose={onExit} />
        {last && (
          <button type="button" onClick={() => void handleUndo()} className="mt-4 min-h-11 text-sm text-neutral-500 underline">
            Letzte Bewertung rückgängig
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Session beenden"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-2xl text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
        >
          ×
        </button>
        <div className="flex-1">
          <ProgressBar done={done} total={done + remaining} />
        </div>
        <button
          type="button"
          onClick={() => void handleUndo()}
          disabled={!last || busy}
          aria-label="Letzte Bewertung rückgängig"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-600 active:bg-neutral-100 disabled:opacity-30 dark:text-neutral-300 dark:active:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-3" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {current && word && (
            <Flashcard
              key={cardKey.current}
              word={word}
              direction={current.card.direction}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
              onSwipe={(r) => void handleRate(r)}
              onSpeak={say}
            />
          )}
        </AnimatePresence>
        {current && !word && (
          <p className="p-6 text-center text-neutral-500">Wort {current.card.wordId} fehlt in den Wortpaketen.</p>
        )}
      </div>

      <footer className="mb-8 min-h-16">
        {revealed ? (
          <RatingButtons intervals={intervals} disabled={busy} onRate={(r) => void handleRate(r)} />
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={!current}
            className="min-h-16 w-full rounded-2xl bg-neutral-100 text-lg font-semibold active:scale-95 dark:bg-neutral-800"
          >
            Aufdecken
          </button>
        )}
      </footer>
    </div>
  );
}
