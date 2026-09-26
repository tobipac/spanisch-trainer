import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { isStandalone } from '../app/platform.ts';
import { CARD_ANIMATION_S } from '../config/labels.ts';

interface Props {
  onDone: () => void;
}

const PAGES = [
  {
    title: 'So lernst du',
    body: [
      'Du lernst die 1.500 häufigsten spanischen Wörter – aus Alltag, Filmen und Nachrichten.',
      'Die App fragt jedes Wort genau dann wieder ab, wenn du es gerade zu vergessen drohst (Spaced Repetition mit FSRS).',
      'Sei ehrlich beim Bewerten: „Nochmal“, wenn du es nicht wusstest – so passt sich der Plan an dich an.',
    ],
  },
  {
    title: 'Dein Tag',
    body: [
      'Jeden Tag: fällige Wiederholungen plus 12 neue Wörter – etwa 15–20 Minuten.',
      'Karte antippen zum Aufdecken, dann bewerten. Wischen: links = Nochmal, rechts = Gut.',
      'Tagesziel geschafft? Dein Streak wächst. Einen verpassten Tag pro Woche rettet der Joker.',
      'Der Lerntag wechselt um 04:00 Uhr.',
    ],
  },
  {
    title: 'Installation & Daten',
    body: [
      'Nutze die App vom Home-Bildschirm: Safari → Teilen → „Zum Home-Bildschirm“. Dann läuft sie auch offline.',
      'Deine Lerndaten bleiben nur auf diesem iPhone. Sichere sie regelmäßig unter Einstellungen → Backup.',
    ],
  },
];

/** Einführung beim ersten Start (SPEC.md Abschnitt 5): 3 Seiten. */
export function OnboardingScreen({ onDone }: Props) {
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page]!;

  return (
    <div className="flex h-full flex-col pb-6">
      <div className="flex justify-end">
        {!last && (
          <button type="button" onClick={onDone} className="min-h-11 px-2 text-sm text-neutral-500">
            Überspringen
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.section
          key={page}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: CARD_ANIMATION_S }}
          className="flex flex-1 flex-col justify-center gap-5"
        >
          <p className="text-sm font-semibold text-accent">
            {page + 1} / {PAGES.length}
          </p>
          <h1 className="text-3xl font-bold">{p.title}</h1>
          {p.body.map((t) => (
            <p key={t} className="text-lg leading-snug text-neutral-700 dark:text-neutral-300">
              {t}
            </p>
          ))}
          {last && isStandalone() && <p className="font-semibold text-accent">✓ Du nutzt die App bereits vom Home-Bildschirm.</p>}
        </motion.section>
      </AnimatePresence>
      <div className="mb-4 flex justify-center gap-2" aria-hidden="true">
        {PAGES.map((_, i) => (
          <span key={i} className={`size-2 rounded-full ${i === page ? 'bg-accent' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => (last ? onDone() : setPage(page + 1))}
        className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white active:scale-95"
      >
        {last ? "Los geht's" : 'Weiter'}
      </button>
    </div>
  );
}
