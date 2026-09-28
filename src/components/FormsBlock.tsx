import { PRESENT_PERSONS, regularPresentParts, verbClass } from '../domain/forms.ts';
import type { Word } from '../domain/types.ts';

interface Props {
  word: Word;
  /** Form, die im Beispielsatz vorkommt (wird bei den 4 Formen hervorgehoben) */
  sentenceForm?: string;
  onSpeak: (text: string) => void;
}

const GENDER4_LABELS = ['m', 'f', 'm Pl.', 'f Pl.'];
// Tabelle 2 × 3: links Singular, rechts Plural
const PRESENT_ORDER = [0, 3, 1, 4, 2, 5];

/** Präsenstabelle statt Endungsmuster: unregelmäßige Formen, Schreib- oder Akzentänderung. */
function hasPresentTable(word: Word): boolean {
  return (word.forms?.irregular?.length ?? 0) > 0 || word.forms?.irregularKind !== undefined;
}

function SectionTitle({ children }: { children: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{children}</p>;
}

function SmallSpeaker() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/** Formenblock der Kartenrückseite: Verben, 4 Genus-/Numerusformen, unregelmäßiger Plural; sonst nichts. */
export function FormsBlock({ word, sentenceForm, onSpeak }: Props) {
  const f = word.forms;
  if (!f) return null;
  const lower = sentenceForm?.toLowerCase();

  const heard = f.heard && f.heard.length > 0 && (word.pos === 'verb' || word.pos === 'adj') && (
    <div className="flex flex-col gap-2.5">
      <SectionTitle>Häufig gehört</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {f.heard.map((form) => (
          <button
            key={form}
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-base font-semibold active:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:active:bg-neutral-700"
            onClick={(e) => {
              e.stopPropagation();
              onSpeak(form);
            }}
            aria-label={`${form} anhören`}
          >
            {form}
            <SmallSpeaker />
          </button>
        ))}
      </div>
    </div>
  );

  if (word.pos === 'verb' && f.present?.length === 6) {
    if (hasPresentTable(word)) {
      const irregular = new Set(f.irregular);
      return (
        <>
          {heard}
          <div className="flex flex-col gap-2.5">
            <SectionTitle>Präsens</SectionTitle>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {PRESENT_ORDER.map((i) => (
                <div key={i} className="flex min-h-[26px] items-baseline gap-2.5">
                  <span className="w-[74px] shrink-0 text-[13px] text-neutral-500 dark:text-neutral-400">{PRESENT_PERSONS[i]}</span>
                  <span className={`text-[17px] font-bold ${irregular.has(i) ? 'text-accent-ink' : ''}`}>{f.present![i]}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      );
    }
    const parts = regularPresentParts(word.es);
    const cls = verbClass(word.es);
    return (
      <>
        {heard}
        {parts && cls && (
          <div className="flex flex-col gap-2.5">
            <SectionTitle>{`Muster -${cls} im Präsens`}</SectionTitle>
            <p className="text-base leading-normal">
              {parts.map(([stem, ending], i) => (
                <span key={i}>
                  {i > 0 && <span className="text-neutral-400"> · </span>}
                  {stem}
                  <span className="font-bold text-accent-ink">{ending}</span>
                </span>
              ))}
            </p>
          </div>
        )}
      </>
    );
  }

  if (f.gender4?.length === 4) {
    return (
      <>
        <div className="flex flex-col gap-2.5">
          <SectionTitle>Formen</SectionTitle>
          <div className="grid grid-cols-4 gap-1.5">
            {f.gender4.map((form, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl bg-neutral-50 px-1.5 py-2.5 dark:bg-neutral-800">
                <span className={`text-base ${form === lower ? 'font-bold text-accent-ink' : 'font-medium'}`}>{form}</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{GENDER4_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Häufig gehört nur, wenn es mehr zeigt als die 4 Formen (z. B. buen, primer) */}
        {f.heard?.some((h) => !f.gender4!.includes(h)) && heard}
      </>
    );
  }

  if (word.pos === 'noun' && f.plural) {
    return (
      <div className="flex flex-col gap-2.5">
        <SectionTitle>Plural</SectionTitle>
        <p className="text-lg font-bold text-accent-ink">{f.plural}</p>
      </div>
    );
  }

  return null;
}
