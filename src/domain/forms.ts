// Wortformen für den Formenblock der Kartenrückseite: Präsensmuster, Plural, Hervorhebung im Beispielsatz.
import type { IrregularKind, StemChange, Word } from './types.ts';

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

/** Beschriftung der Arten von Abweichung (für Etikett und Stichprobe). */
export const IRREGULAR_KIND_LABELS: Record<IrregularKind, string> = { accent: 'Akzent', spelling: 'Schreibänderung' };

/**
 * Art der Abweichung vom regelmäßigen Präsens: „accent“, wenn sich die abweichenden Formen nur im
 * Akzent unterscheiden (envío, actúo, reúno), „spelling“, wenn nur die yo-Form orthografisch angepasst
 * wird (g → j: protejo, c → z nach Konsonant: venzo, gu → g: distingo). Sonst null (echt unregelmäßig).
 */
export function irregularKind(infinitive: string, present: readonly string[]): IrregularKind | null {
  const regular = regularPresent(infinitive);
  const idx = irregularIndices(infinitive, present);
  if (!regular || idx.length === 0) return null;
  if (idx.every((i) => stripAccents(present[i]!) === stripAccents(regular[i]!))) return 'accent';
  if (idx.length === 1 && idx[0] === 0) {
    const stem = regular[0]!.slice(0, -1);
    const yo = present[0];
    if (stem.endsWith('g') && yo === `${stem.slice(0, -1)}jo`) return 'spelling';
    if (/[^aeiouáéíóú]c$/.test(stem) && yo === `${stem.slice(0, -1)}zo`) return 'spelling';
    if (stem.endsWith('gu') && yo === `${stem.slice(0, -1)}o`) return 'spelling';
  }
  return null;
}

/** Stammwechsel, geprüft an der él-Form: e → ie vor e → i, damit pienso nicht als e → i gilt. */
const STEM_CHANGES: Array<[from: string, to: string, label: StemChange]> = [
  ['e', 'ie', 'e → ie'],
  ['o', 'ue', 'o → ue'],
  ['u', 'ue', 'u → ue'],
  ['e', 'i', 'e → i'],
];

/**
 * Stammwechsel im Präsens (tener → tiene: e → ie) oder null. Die nosotros-Form muss regelmäßig
 * sein (typisches „Stiefel“-Muster), sonst liegt kein Stammwechsel vor.
 */
export function stemChange(infinitive: string, present: readonly string[]): StemChange | null {
  const regular = regularPresent(infinitive);
  const third = present[2];
  if (!regular || !third || present[3] !== regular[3]) return null;
  const stem = infinitive.slice(0, -2);
  const changedStem = third.slice(0, -1);
  for (const [from, to, label] of STEM_CHANGES) {
    for (let i = stem.lastIndexOf(from); i >= 0; i = stem.lastIndexOf(from, i - 1)) {
      if (stem.slice(0, i) + to + stem.slice(i + from.length) === changedStem) return label;
      if (i === 0) break;
    }
  }
  return null;
}

/** Adjektive auf -or ohne weibliche Form (Komparative u. Ä.). */
const INVARIABLE_OR = new Set(['mejor', 'peor', 'mayor', 'menor', 'superior', 'inferior', 'anterior', 'posterior', 'interior', 'exterior', 'ulterior']);
/** Nationalitäten auf Konsonant, die nicht auf -és/-án enden. */
const CONSONANT_NATIONALITIES = new Set(['español', 'andaluz']);

const unaccentLast = (s: string) => s.replace(/[áéíóú](?=[^áéíóú]*$)/, (c) => stripAccents(c));

/**
 * 4 Formen eines veränderlichen Adjektivs (m. Sg., f. Sg., m. Pl., f. Pl.) oder null, wenn es nur
 * nach Einzahl/Mehrzahl variiert: -o, -or, -án/-ín/-ón, -és und Nationalitäten auf Konsonant.
 */
export function adjGender4(es: string): string[] | null {
  if (es.endsWith('o')) {
    const stem = es.slice(0, -1);
    return [es, `${stem}a`, `${es}s`, `${stem}as`];
  }
  const consonantPlural = (base: string) => (base.endsWith('z') ? `${base.slice(0, -1)}ces` : `${base}es`);
  if ((es.endsWith('or') && !INVARIABLE_OR.has(es)) || CONSONANT_NATIONALITIES.has(es)) {
    return [es, `${es}a`, consonantPlural(es), `${es}as`];
  }
  if (/(án|ín|ón|és)$/.test(es) && es !== 'cortés') {
    const base = unaccentLast(es);
    return [es, `${base}a`, `${base}es`, `${base}as`];
  }
  return null;
}

/** Plural nach der Grundregel: Vokal + s, Konsonant + es (ohne Schreibänderungen). */
export function regularPlural(noun: string): string {
  return /[aeiouáéó]$/i.test(noun) ? `${noun}s` : `${noun}es`;
}

/**
 * Plural mit Schreibregeln: -z → -ces (vez → veces), betonte Endsilbe auf -n/-s verliert den Akzent
 * (canción → canciones, autobús → autobuses), außer bei í/ú im Hiat (país → países).
 * Mehrsilbige Wörter auf unbetontes Vokal + s bleiben gleich (lunes, crisis).
 * Akzentverschiebungen (joven → jóvenes) lassen sich so nicht ableiten.
 */
export function spellingPlural(noun: string): string {
  // unbetonte Endsilbe auf Vokal + s, mehrsilbig: unveränderlich (el lunes → los lunes, la crisis)
  const syllables = noun.match(/[aeiouáéíóú]+/g)?.length ?? 0;
  if (syllables >= 2 && /[aeiou]s$/.test(noun) && !/[áéíóú][^aeiouáéíóú]*s$/.test(noun) && !/[áéíóú]s$/.test(noun)) {
    return noun;
  }
  if (noun.endsWith('z')) return `${noun.slice(0, -1)}ces`;
  if (/[áéó][ns]$/.test(noun) || /(^|[^aeiouáéó])[íú][ns]$/.test(noun)) return `${unaccentLast(noun)}es`;
  return regularPlural(noun);
}

/** Alle Formen des Wortes, die im Beispielsatz vorkommen können. */
export function knownForms(word: Pick<Word, 'es' | 'pos' | 'forms'>): string[] {
  const f = word.forms;
  const out = [word.es, ...(f?.heard ?? []), ...(f?.present ?? []), ...(f?.gender4 ?? [])];
  if (word.pos === 'noun') out.push(f?.plural ?? regularPlural(word.es));
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
