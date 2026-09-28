// Wortformen für den Formenblock der Kartenrückseite: Präsensmuster, Plural, Hervorhebung im Beispielsatz.
import type { Word } from './types.ts';

export type VerbClass = 'ar' | 'er' | 'ir';

/** Endungen im Präsens (yo, tú, él, nosotros, vosotros, ellos). */
export const PRESENT_ENDINGS: Record<VerbClass, readonly string[]> = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
};

/** Personalpronomen zu den 6 Präsensformen (für die Tabelle). */
export const PRESENT_PERSONS = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos'] as const;

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

/** Konjugationsklasse aus dem Infinitiv (oír zählt zu -ir). */
export function verbClass(infinitive: string): VerbClass | null {
  const end = stripAccents(infinitive.toLowerCase()).slice(-2);
  return end === 'ar' || end === 'er' || end === 'ir' ? end : null;
}

/** Stamm und Endungen eines regelmäßigen Verbs im Präsens, z. B. hablar → [habl, o], [habl, as] … */
export function regularPresentParts(infinitive: string): Array<[stem: string, ending: string]> | null {
  const cls = verbClass(infinitive);
  if (!cls) return null;
  const stem = infinitive.slice(0, -2);
  return PRESENT_ENDINGS[cls].map((e) => [stem, e]);
}

/** Regelmäßiges Präsens (6 Formen) oder null, wenn kein Infinitiv. */
export function regularPresent(infinitive: string): string[] | null {
  return regularPresentParts(infinitive)?.map(([s, e]) => s + e) ?? null;
}

/** Indizes der Formen, die vom regelmäßigen Muster abweichen. */
export function irregularIndices(infinitive: string, present: readonly string[]): number[] {
  const regular = regularPresent(infinitive);
  return present.flatMap((f, i) => (regular && regular[i] === f ? [] : [i]));
}

/** Plural nach der Grundregel: Vokal + s, Konsonant + es (ohne Schreibänderungen). */
export function regularPlural(noun: string): string {
  return /[aeiouáéó]$/i.test(noun) ? `${noun}s` : `${noun}es`;
}

/** Alle Formen des Wortes, die im Beispielsatz vorkommen können. */
export function knownForms(word: Pick<Word, 'es' | 'pos' | 'forms'>): string[] {
  const f = word.forms;
  const out = [word.es, ...(f?.heard ?? []), ...(f?.present ?? []), ...(f?.adj ?? [])];
  if (word.pos === 'noun') out.push(f?.plural ?? regularPlural(word.es));
  // Begleiter, Pronomen, Adjektive: Genus- und Pluralformen (uno → una, ese → esa, eso, mío → mía)
  if (['det', 'pron', 'adj'].includes(word.pos) && /[oe]$/.test(word.es)) {
    const stem = word.es.slice(0, -1);
    out.push(`${stem}a`, `${stem}o`, `${stem}os`, `${stem}as`);
  }
  return out.map((s) => s.toLowerCase());
}

export interface Highlight {
  before: string;
  match: string;
  after: string;
}

/**
 * Sucht die Form des Wortes im Satz: zuerst exakte Formen, dann (ohne Akzente) den Wortstamm
 * mit mindestens 3 Zeichen – bei Verben ohne Infinitivendung, sonst ohne letzten Buchstaben.
 */
export function highlightForm(word: Pick<Word, 'es' | 'pos' | 'forms'>, sentence: string): Highlight | null {
  const tokens = [...sentence.matchAll(/[\p{L}\p{N}]+/gu)];
  const forms = new Set(knownForms(word));
  const lemma = stripAccents(word.es.toLowerCase());
  const stem = word.pos === 'verb' ? lemma.slice(0, -2) : lemma.slice(0, -1);
  const hit =
    tokens.find((t) => forms.has(t[0].toLowerCase())) ??
    (stem.length >= 3 ? tokens.find((t) => stripAccents(t[0].toLowerCase()).startsWith(stem)) : undefined);
  if (!hit || hit.index === undefined) return null;
  return {
    before: sentence.slice(0, hit.index),
    match: hit[0],
    after: sentence.slice(hit.index + hit[0].length),
  };
}
