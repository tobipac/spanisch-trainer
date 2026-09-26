// Prüfregeln für die Wortpakete (SPEC.md Abschnitt 8.3). Reine Funktionen, getestet in tests/wordChecks.test.ts.
import type { Word } from '../../src/domain/types.ts';

export const MAX_SENTENCE_WORDS = 10;
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
    }
  }
  if (range && words.length !== range[1] - range[0] + 1) {
    err(fileName, `enthält ${words.length} Einträge, erwartet ${range[1] - range[0] + 1}`);
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
