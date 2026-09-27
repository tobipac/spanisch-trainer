import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { CARD_ANIMATION_S, POS_LABELS, SWIPE_THRESHOLD_PX } from '../config/labels.ts';
import type { Direction, Rating, Word } from '../domain/types.ts';
import { SpeakerButton } from './SpeakerButton.tsx';

interface Props {
  word: Word;
  direction: Direction;
  revealed: boolean;
  onReveal: () => void;
  onSwipe: (rating: Rating) => void;
  onSpeak: (text: string) => void;
}

const withArticle = (w: Word) => (w.article ? `${w.article} ${w.es}` : w.es);

/** Lernkarte: Tippen dreht um, nach dem Aufdecken Wischen links = Nochmal, rechts = Gut. */
export function Flashcard({ word, direction, revealed, onReveal, onSwipe, onSpeak }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const againOpacity = useTransform(x, [-SWIPE_THRESHOLD_PX, -20], [1, 0]);
  const goodOpacity = useTransform(x, [20, SWIPE_THRESHOLD_PX], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x + info.velocity.x * 0.2;
    if (dx <= -SWIPE_THRESHOLD_PX) onSwipe(1);
    else if (dx >= SWIPE_THRESHOLD_PX) onSwipe(3);
  };

  const spanish = withArticle(word);

  const front =
    direction === 'es-de' ? (
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold">{spanish}</p>
        <SpeakerButton onPress={() => onSpeak(spanish)} />
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3">
        <p className="text-4xl font-bold">{word.de}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">auf Spanisch?</p>
      </div>
    );

  return (
    <motion.div
      className="relative h-full w-full touch-pan-y select-none [perspective:1200px]"
      style={{ x, rotate }}
      drag={revealed ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: CARD_ANIMATION_S }}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: CARD_ANIMATION_S, ease: 'easeOut' }}
        onClick={() => !revealed && onReveal()}
        role="button"
        aria-label={revealed ? 'Karte (aufgedeckt)' : 'Karte aufdecken'}
      >
        {/* Vorderseite */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-white p-6 text-center shadow-sm [backface-visibility:hidden] dark:border-neutral-800 dark:bg-neutral-900">
          {front}
          <p className="absolute bottom-5 text-sm text-neutral-400">Tippen zum Aufdecken</p>
        </div>

        {/* Rückseite */}
        <div className="absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              {direction === 'es-de' ? (
                <>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{spanish}</p>
                  <p className="text-3xl font-bold">{word.de}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{word.de}</p>
                  <p className="text-3xl font-bold">{spanish}</p>
                </>
              )}
              {word.deAlt && word.deAlt.length > 0 && (
                <p className="mt-1 text-base text-neutral-600 dark:text-neutral-300">auch: {word.deAlt.join('; ')}</p>
              )}
              <p className="mt-2 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {POS_LABELS[word.pos]}
              </p>
            </div>
            <SpeakerButton onPress={() => onSpeak(word.es)} />
          </div>

          <button
            type="button"
            className="mt-6 rounded-2xl bg-neutral-50 p-4 text-left active:bg-neutral-100 dark:bg-neutral-800/60 dark:active:bg-neutral-800"
            onClick={(e) => {
              e.stopPropagation();
              onSpeak(word.exampleEs);
            }}
            aria-label="Beispielsatz anhören"
          >
            <p className="text-lg font-medium">{word.exampleEs}</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">{word.exampleDe}</p>
          </button>

          {word.note && <p className="mt-5 text-lg leading-snug text-neutral-700 dark:text-neutral-300">💡 {word.note}</p>}
        </div>
      </motion.div>

      {/* Wisch-Hinweise */}
      <motion.div
        className="pointer-events-none absolute left-4 top-4 rounded-lg border-2 border-neutral-900 px-2 py-1 text-sm font-bold dark:border-neutral-100"
        style={{ opacity: againOpacity }}
      >
        Nochmal
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 rounded-lg border-2 border-accent-ink px-2 py-1 text-sm font-bold text-accent-ink"
        style={{ opacity: goodOpacity }}
      >
        Gut
      </motion.div>
    </motion.div>
  );
}
