import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { ARTICLE_LEMMAS, CARD_ANIMATION_S, POS_LABELS, SWIPE_THRESHOLD_PX } from '../config/labels.ts';
import { highlightForm, IRREGULAR_KIND_LABELS, verbClass } from '../domain/forms.ts';
import type { Direction, Rating, Word } from '../domain/types.ts';
import { FormsBlock, isIrregularVerb } from './FormsBlock.tsx';
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
const posLabel = (w: Word) => (w.pos === 'det' && ARTICLE_LEMMAS.includes(w.es) ? 'Artikel' : POS_LABELS[w.pos]);

/** Zusatz-Labels bei Verben mit Präsensformen: „unregelmäßig“ (+ Stammwechsel), „Akzent“/„Schreibänderung“ oder „regelmäßig · -ar“. */
function verbLabels(w: Word): Array<{ text: string; accent: boolean }> {
  if (w.pos !== 'verb' || w.forms?.present?.length !== 6) return [];
  if (w.forms.irregularKind) return [{ text: IRREGULAR_KIND_LABELS[w.forms.irregularKind], accent: false }];
  if (isIrregularVerb(w)) {
    const labels = [{ text: 'unregelmäßig', accent: true }];
    if (w.forms.stemChange) labels.push({ text: w.forms.stemChange, accent: true });
    return labels;
  }
  const cls = verbClass(w.es);
  return cls ? [{ text: `regelmäßig · -${cls}`, accent: false }] : [];
}

const chip = 'rounded-full px-2.5 py-1 text-xs font-semibold';

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
  const hl = highlightForm(word, word.exampleEs);
  const verb = verbLabels(word);

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

        {/* Rückseite: Spanisch groß oben, Deutsch darunter, Beispielsatz, Formenblock, Hinweis; vertikal zentriert (my-auto), scrollt bei Überlänge */}
        <div className="absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-neutral-200 bg-white px-[22px] py-6 [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-neutral-800 dark:bg-neutral-900">
          <div className="my-auto flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-4xl font-bold leading-tight tracking-tight">{spanish}</p>
                <SpeakerButton onPress={() => onSpeak(word.es)} />
              </div>
              <p className="text-xl leading-snug text-neutral-700 dark:text-neutral-300">{word.de}</p>
              {word.deAlt && word.deAlt.length > 0 && (
                <p className="text-base text-neutral-600 dark:text-neutral-400">auch: {word.deAlt.join('; ')}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className={`${chip} bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300`}>{posLabel(word)}</span>
                {verb.map((l) => (
                  <span
                    key={l.text}
                    className={`${chip} ${l.accent ? 'bg-accent/10 text-accent-ink dark:bg-accent-ink/15' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}
                  >
                    {l.text}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="rounded-2xl bg-neutral-50 p-4 text-left active:bg-neutral-100 dark:bg-neutral-800/60 dark:active:bg-neutral-800"
              onClick={(e) => {
                e.stopPropagation();
                onSpeak(word.exampleEs);
              }}
              aria-label="Beispielsatz anhören"
            >
              <p className="text-[17px] font-semibold leading-snug">
                {hl ? (
                  <>
                    {hl.before}
                    <strong className="font-bold text-accent-ink">{hl.match}</strong>
                    {hl.after}
                  </>
                ) : (
                  word.exampleEs
                )}
              </p>
              <p className="mt-1.5 text-[15px] text-neutral-600 dark:text-neutral-400">{word.exampleDe}</p>
            </button>

            <FormsBlock word={word} sentenceForm={hl?.match} onSpeak={onSpeak} />

            {word.note && (
              <div className="flex gap-2.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-neutral-400">
                  <path d="M9 18h6" />
                  <path d="M10 21h4" />
                  <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
                </svg>
                <p>{word.note}</p>
              </div>
            )}
          </div>
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
