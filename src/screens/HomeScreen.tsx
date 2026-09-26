import { useEffect, useState } from 'react';
import { unlockAudio } from '../audio/speech.ts';
import { APP_NAME } from '../config/app.ts';
import { SECONDS_PER_CARD } from '../config/learning.ts';
import { WORD_REFS } from '../data/words.ts';
import { db } from '../db/database.ts';
import { getOrCreateDay, loadSettings } from '../db/repository.ts';
import { remainingToday } from '../domain/session.ts';

interface Props {
  onStart: () => void;
}

/** Vorläufiger Startbildschirm (E3). Der vollständige Heute-Screen folgt in E4. */
export function HomeScreen({ onStart }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const now = new Date();
      const [day, cards, settings] = await Promise.all([
        getOrCreateDay(db, now, WORD_REFS),
        db.cards.toArray(),
        loadSettings(db),
      ]);
      setRemaining(remainingToday({ day, cards, words: WORD_REFS, settings }));
    })();
  }, []);

  const minutes = remaining === null ? null : Math.ceil((remaining * SECONDS_PER_CARD) / 60);

  return (
    <div className="flex h-full flex-col">
      <header className="py-4">
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Heute</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-6xl font-bold">{remaining ?? '–'}</p>
        <p className="text-neutral-600 dark:text-neutral-400">Karten heute</p>
        {minutes !== null && remaining !== 0 && (
          <p className="text-sm text-neutral-500">ca. {minutes} Minuten</p>
        )}
      </main>

      <button
        type="button"
        onClick={() => {
          unlockAudio(); // iOS: Audio nur nach einer Nutzerberührung
          onStart();
        }}
        className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95"
      >
        Lernen starten
      </button>
    </div>
  );
}
