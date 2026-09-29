import { useCallback, useEffect, useState } from 'react';
import { now as clockNow } from '../app/clock.ts';
import { logError } from '../app/errorLog.ts';
import { speak } from '../audio/speech.ts';
import { Flashcard } from '../components/Flashcard.tsx';
import { WORD_BY_ID } from '../data/words.ts';
import { db } from '../db/database.ts';
import { loadSettings, savePracticeResult } from '../db/repository.ts';
import { weakWordIds } from '../domain/difficulty.ts';
import { learningDayOf } from '../domain/learningDay.ts';
import {
  answerPractice,
  createPractice,
  currentPractice,
  isPracticeDone,
  practiceResult,
  type PracticeState,
} from '../domain/practice.ts';
import type { PracticeResult, Settings } from '../domain/types.ts';

interface Props {
  onExit: () => void;
}

/** Extra-Übung „Schwache Wörter“: gewusst / nicht gewusst, ohne FSRS, eigenes Ergebnis. */
export function PracticeScreen({ onExit }: Props) {
  const [state, setState] = useState<PracticeState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    void (async () => {
      const [logs, s] = await Promise.all([db.reviewLogs.toArray(), loadSettings(db)]);
      const ids = weakWordIds(logs, clockNow()).filter((id) => WORD_BY_ID.has(id));
      setSettings(s);
      setState(createPractice(ids));
    })().catch((e: unknown) => logError(e, 'Übung laden'));
  }, []);

  const say = useCallback(
    (text: string) => settings && speak(text, { rate: settings.speechRate, voiceURI: settings.voiceURI }),
    [settings],
  );

  const answer = useCallback(
    async (known: boolean) => {
      if (!state || !revealed) return;
      const next = answerPractice(state, known);
      setRevealed(false);
      setStep((n) => n + 1);
      if (isPracticeDone(next)) {
        const t = clockNow();
        const r = practiceResult(next, t, learningDayOf(t));
        try {
          await savePracticeResult(db, r);
        } catch (e) {
          logError(e, 'Übung speichern');
        }
        setResult(r);
      }
      setState(next);
    },
    [state, revealed],
  );

  if (!state) return <div className="h-full" />;

  if (result || isPracticeDone(state)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <h2 className="text-2xl font-bold">Übung beendet</h2>
        {result && (
          <>
            <p className="text-lg">
              <strong className="text-4xl">{result.known}</strong> von {result.total} gewusst
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">+{result.xp} Trainings-XP</p>
          </>
        )}
        <button
          type="button"
          onClick={onExit}
          className="min-h-14 w-full max-w-xs rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95"
        >
          Fertig
        </button>
      </div>
    );
  }

  const item = currentPractice(state)!;
  const word = WORD_BY_ID.get(item.wordId);
  const done = state.words.length - new Set(state.queue.map((q) => q.wordId)).size;

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Übung beenden"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-2xl text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
        >
          ×
        </button>
        <p className="flex-1 text-sm text-neutral-600 dark:text-neutral-400">
          Schwache Wörter · {done} / {state.words.length}
        </p>
      </header>

      <div className="relative min-h-0 flex-1">
        {word && (
          <Flashcard
            key={step}
            word={word}
            direction={item.direction}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onSwipe={(r) => void answer(r !== 1)}
            onSpeak={say}
          />
        )}
      </div>

      <footer className="mb-8 min-h-16">
        {revealed ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void answer(false)}
              className="min-h-16 rounded-2xl bg-neutral-100 text-lg font-semibold active:scale-95 dark:bg-neutral-800"
            >
              Nicht gewusst
            </button>
            <button
              type="button"
              onClick={() => void answer(true)}
              className="min-h-16 rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95"
            >
              Gewusst
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="min-h-16 w-full rounded-2xl bg-neutral-100 text-lg font-semibold active:scale-95 dark:bg-neutral-800"
          >
            Aufdecken
          </button>
        )}
      </footer>
    </div>
  );
}
