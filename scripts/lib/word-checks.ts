// Prüfregeln für die Wortpakete (SPEC.md Abschnitt 8.3). Reine Funktionen, getestet in tests/wordChecks.test.ts.
import { irregularIndices, regularPlural, stemChange, verbClass } from '../../src/domain/forms.ts';
import type { Word } from '../../src/domain/types.ts';

export const MAX_SENTENCE_WORDS = 10;
export const MAX_HEARD = 3;
export const GENDER4_POS: readonly string[] = ['adj', 'det', 'pron', 'adv'];
export const MAX_DE_ALT = 2;
export const POS_VALUES = ['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'det', 'num', 'interj', 'other'] as const;
export const ARTICLES = ['el', 'la', 'los', 'las'] as const;

/** Eine Zeile aus data/ranking/lemma-ranking.csv (nur die für die Prüfung nötigen Spalten). */
export interface RankingRow {
  rank: number;
  lemma: string;
  freqShare: number;
  topForms: string[];
  ambiguous: boolean;
}

export interface Finding {
  level: 'error' | 'warning';
  id: string;
  message: string;
}

export function parseRanking(csv: string): RankingRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = (header ?? '').split(',');
  const idx = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`Spalte ${name} fehlt in lemma-ranking.csv`);
    return i;
  };
  const [iRank, iLemma, iShare, iForms, iAmb] = ['rank', 'lemma', 'freqShare', 'topForms', 'ambiguous'].map(idx);
  return lines
    .map((line) => line.split(','))
    .filter((c) => c[iRank!] !== '')
    .map((c) => ({
      rank: Number(c[iRank!]),
      lemma: c[iLemma!]!,
      freqShare: Number(c[iShare!]),
      topForms: (c[iForms!] ?? '').split(' ').filter(Boolean),
      ambiguous: c[iAmb!] === 'true',
    }));
}

/** Wörter eines Satzes (Satzzeichen entfernt, kleingeschrieben). */
export function sentenceWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(Boolean);
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

/** Kommt das Lemma, eine seiner häufigen Formen oder sein Wortstamm im Satz vor? */
export function sentenceContainsLemma(word: Pick<Word, 'es' | 'pos'>, sentence: string, forms: string[] = []): boolean {
  const words = sentenceWords(sentence).map(stripAccents);
  const candidates = [word.es, ...forms].map((f) => stripAccents(f.toLowerCase()));
  if (candidates.some((c) => words.includes(c))) return true;
  // Stamm: bei Verben ohne Infinitivendung, sonst ohne letzten Buchstaben; mindestens 3 Zeichen
  const lemma = stripAccents(word.es.toLowerCase());
  const stem = word.pos === 'verb' ? lemma.slice(0, -2) : lemma.slice(0, -1);
  return stem.length >= 3 && words.some((w) => w.startsWith(stem));
}

/** Erwarteter Rangbereich aus dem Dateinamen, z. B. words-0001-0300.json → [1, 300]. */
export function rangeFromFileName(name: string): [number, number] | null {
  const m = /^words-(\d{4})-(\d{4})\.json$/.exec(name);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Bekannte Ausnahmen der Genus-Faustregeln (Einzahl-Lemma). */
const FEMININE_EXCEPTIONS = new Set(['mano', 'foto', 'radio', 'moto', 'modelo']); // la … trotz -o (la modelo = das Model)
const MASCULINE_EXCEPTIONS = new Set([
  'día', 'mapa', 'planeta', 'sofá', 'papá', 'idioma', 'clima', 'drama', 'problema', 'sistema', 'programa', 'tema',
  'poema', 'esquema', 'síntoma', 'dilema', 'fantasma', 'policía', 'idiota', 'artista', 'guía', 'colega', 'pijama',
]);
/** Weibliche Nomen mit betontem a-/ha-: in der Einzahl „el“ (el agua, el área, el alma). */
const EL_FEMININE = new Set(['agua', 'área', 'alma', 'arma', 'hambre', 'águila', 'aula', 'hacha', 'ala', 'arte']);

/**
 * Plausibilität des Artikels nach typischen Endungen (nur Warnung – das Spanische hat Ausnahmen).
 * Liefert eine Meldung oder null.
 */
export function articleHint(es: string, article: string | undefined): string | null {
  if (!article) return null;
  const w = es.toLowerCase();
  if (article === 'la' && w.endsWith('o') && !FEMININE_EXCEPTIONS.has(w)) return `„la ${es}“: Nomen auf -o sind meist männlich`;
  // -ista-Nomen haben beide Geschlechter (el/la artista, el/la periodista)
  if (article === 'el' && !MASCULINE_EXCEPTIONS.has(w) && !EL_FEMININE.has(w) && !w.endsWith('ista')) {
    if (/(ción|sión|dad|tad|tud|umbre)$/.test(w)) return `„el ${es}“: Nomen auf -ción/-dad/-tud/-umbre sind weiblich`;
    if (w.endsWith('a') && !w.endsWith('ma')) return `„el ${es}“: Nomen auf -a sind meist weiblich`;
  }
  return null;
}

const REQUIRED: Array<keyof Word> = ['id', 'rank', 'freqShare', 'es', 'pos', 'de', 'exampleEs', 'exampleDe'];

/** Prüft ein Paket für sich (Felder, Formate, Satzlänge, Übereinstimmung mit der Rangliste). */
export function checkPackage(fileName: string, words: Word[], ranking: Map<number, RankingRow>): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ level: 'error', id, message });
  const warn = (id: string, message: string) => out.push({ level: 'warning', id, message });

  const range = rangeFromFileName(fileName);
  if (!range) err(fileName, 'Dateiname muss words-NNNN-NNNN.json sein');

  for (const w of words) {
    const id = w.id ?? '(ohne id)';
    for (const key of REQUIRED) {
      const v = w[key];
      if (v === undefined || v === null || v === '') err(id, `Pflichtfeld ${key} fehlt`);
    }
    if (!/^w\d{4}$/.test(w.id ?? '')) err(id, 'id muss das Format w0001 haben');
    if (!POS_VALUES.includes(w.pos)) err(id, `ungültige Wortart ${String(w.pos)}`);
    if (w.article !== undefined) {
      if (w.pos !== 'noun') err(id, 'article nur bei Nomen');
      if (!ARTICLES.includes(w.article)) err(id, `ungültiger Artikel ${String(w.article)}`);
      const hint = articleHint(w.es, w.article);
      if (hint) warn(id, hint);
    }
    if (w.deAlt !== undefined && w.deAlt.length > MAX_DE_ALT) err(id, `deAlt hat mehr als ${MAX_DE_ALT} Einträge`);
    if (typeof w.exampleEs === 'string' && sentenceWords(w.exampleEs).length > MAX_SENTENCE_WORDS) {
      err(id, `Beispielsatz hat mehr als ${MAX_SENTENCE_WORDS} Wörter`);
    }
    if (range && (w.rank < range[0] || w.rank > range[1])) err(id, `Rang ${w.rank} passt nicht zu ${fileName}`);

    const row = ranking.get(w.rank);
    if (!row) {
      err(id, `Rang ${w.rank} fehlt in lemma-ranking.csv`);
    } else {
      if (row.lemma !== w.es) err(id, `Rang ${w.rank} ist in der Rangliste „${row.lemma}“, nicht „${w.es}“`);
      if (Math.abs(row.freqShare - w.freqShare) > 1e-12) err(id, `freqShare weicht von der Rangliste ab`);
      if (typeof w.exampleEs === 'string' && !sentenceContainsLemma(w, w.exampleEs, row.topForms)) {
        warn(id, `„${w.es}“ kommt im Beispielsatz nicht erkennbar vor`);
      }
      for (const f of w.forms?.heard ?? []) {
        if (!row.topForms.includes(f)) err(id, `forms.heard „${f}“ steht nicht in topForms der Rangliste`);
      }
    }
    if (w.forms !== undefined) out.push(...checkForms(w));
  }
  if (range && words.length !== range[1] - range[0] + 1) {
    err(fileName, `enthält ${words.length} Einträge, erwartet ${range[1] - range[0] + 1}`);
  }
  return out;
}

/** Prüft den Formenblock eines Eintrags (ohne Rangliste; heard ⊆ topForms prüft checkPackage). */
export function checkForms(w: Word): Finding[] {
  const out: Finding[] = [];
  const err = (message: string) => out.push({ level: 'error', id: w.id, message });
  const warn = (message: string) => out.push({ level: 'warning', id: w.id, message });
  const f = w.forms!;
  const isStringList = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '');

  if (f.heard !== undefined) {
    if (!isStringList(f.heard) || f.heard.length === 0) err('forms.heard muss eine Liste von Formen sein');
    else if (f.heard.length > MAX_HEARD) err(`forms.heard hat mehr als ${MAX_HEARD} Formen`);
  }
  if (f.present !== undefined) {
    if (w.pos !== 'verb') err('forms.present nur bei Verben');
    if (!isStringList(f.present) || f.present.length !== 6) err('forms.present muss genau 6 Formen haben');
  }
  if (f.irregular !== undefined) {
    if (f.present === undefined) err('forms.irregular ohne forms.present');
    const valid =
      Array.isArray(f.irregular) &&
      f.irregular.every((i, k) => Number.isInteger(i) && i >= 0 && i <= 5 && (k === 0 || i > f.irregular![k - 1]!));
    if (!valid) err('forms.irregular muss aufsteigende Indizes 0–5 enthalten');
  }
  if (f.present?.length === 6 && verbClass(w.es)) {
    const expected = irregularIndices(w.es, f.present);
    if (expected.join() !== (f.irregular ?? []).join()) {
      warn(`forms.irregular [${(f.irregular ?? []).join(', ')}] weicht vom regelmäßigen Muster ab, erwartet [${expected.join(', ')}]`);
    }
  }
  if (f.present?.length === 6 && (stemChange(w.es, f.present) ?? undefined) !== f.stemChange) {
    warn(`forms.stemChange „${f.stemChange ?? '–'}“ passt nicht zum Präsens, erwartet „${stemChange(w.es, f.present) ?? '–'}“`);
  }
  if (f.stemChange !== undefined && f.present === undefined) err('forms.stemChange ohne forms.present');
  if (f.gender4 !== undefined) {
    if (!GENDER4_POS.includes(w.pos)) err('forms.gender4 nur bei Adjektiven, Begleitern, Pronomen und Adverbien');
    if (!isStringList(f.gender4) || f.gender4.length !== 4) err('forms.gender4 muss genau 4 Formen haben');
  }
  if (f.plural !== undefined) {
    if (w.pos !== 'noun') err('forms.plural nur bei Nomen');
    if (typeof f.plural !== 'string' || f.plural.trim() === '') err('forms.plural muss eine Form sein');
    else if (f.plural === regularPlural(w.es)) warn(`forms.plural „${f.plural}“ ist regelmäßig und kann entfallen`);
  }
  if (w.note && /(unregelmäßig|Formen)\s*:/i.test(w.note) && (f.present || f.gender4)) {
    warn('note enthält eine Formenliste – die Formen stehen bereits im Formenblock');
  }
  return out;
}

/** Prüft alle Pakete zusammen: id und rank eindeutig und lückenlos, freqShare fällt nie ansteigend. */
export function checkAll(words: Word[]): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ level: 'error', id, message });
  const ids = new Set<string>();
  const ranks = new Set<number>();
  for (const w of words) {
    if (ids.has(w.id)) err(w.id, 'id doppelt');
    ids.add(w.id);
    if (ranks.has(w.rank)) err(w.id, `Rang ${w.rank} doppelt`);
    ranks.add(w.rank);
  }
  const sorted = [...words].sort((a, b) => a.rank - b.rank);
  sorted.forEach((w, i) => {
    if (w.rank !== i + 1) err(w.id, `Ränge nicht lückenlos: erwartet ${i + 1}, gefunden ${w.rank}`);
    const prev = sorted[i - 1];
    if (prev && w.freqShare > prev.freqShare) err(w.id, 'freqShare steigt gegenüber dem vorherigen Rang');
  });
  return out;
}
