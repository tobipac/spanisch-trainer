import { describe, expect, it } from 'vitest';
import {
  checkAll,
  checkPackage,
  parseRanking,
  rangeFromFileName,
  sentenceContainsLemma,
  sentenceWords,
  type RankingRow,
} from '../scripts/lib/word-checks.ts';
import type { Word } from '../src/domain/types.ts';

const CSV = `rank,lemma,pos,count,freqShare,topForms,ambiguous,excluded
1,casa,noun,100,0.00300000,casa casas,false,false
,señor,noun,90,0.00290000,señor,false,true
2,tener,verb,80,0.00200000,tengo tiene,true,false
3,rápido,adj,70,0.00200000,rápido rápida,false,false`;

const ranking = new Map<number, RankingRow>(parseRanking(CSV).map((r) => [r.rank, r]));

const word = (over: Partial<Word> = {}): Word => ({
  id: 'w0001',
  rank: 1,
  freqShare: 0.003,
  es: 'casa',
  article: 'la',
  pos: 'noun',
  de: 'Haus',
  exampleEs: 'Mi casa es pequeña.',
  exampleDe: 'Mein Haus ist klein.',
  ...over,
});

const pkg = (): Word[] => [
  word(),
  word({ id: 'w0002', rank: 2, freqShare: 0.002, es: 'tener', article: undefined, pos: 'verb', de: 'haben', exampleEs: 'Tengo dos hermanos.', exampleDe: 'Ich habe zwei Geschwister.' }),
  word({ id: 'w0003', rank: 3, freqShare: 0.002, es: 'rápido', article: undefined, pos: 'adj', de: 'schnell', exampleEs: 'El tren es rápido.', exampleDe: 'Der Zug ist schnell.' }),
];

const errors = (f: ReturnType<typeof checkPackage>) => f.filter((x) => x.level === 'error').map((x) => x.message);

describe('Rangliste einlesen', () => {
  it('überspringt gestrichene Lemmata ohne Rang', () => {
    const rows = parseRanking(CSV);
    expect(rows.map((r) => r.lemma)).toEqual(['casa', 'tener', 'rápido']);
    expect(rows[1]).toMatchObject({ rank: 2, topForms: ['tengo', 'tiene'], ambiguous: true });
  });
});

describe('Hilfsfunktionen', () => {
  it('zählt Satzwörter ohne Satzzeichen', () => {
    expect(sentenceWords('¿Dónde está mi casa?')).toEqual(['dónde', 'está', 'mi', 'casa']);
  });

  it('erkennt Lemma, Formen und Wortstamm', () => {
    expect(sentenceContainsLemma({ es: 'casa', pos: 'noun' }, 'Las casas son grandes.')).toBe(true);
    expect(sentenceContainsLemma({ es: 'tener', pos: 'verb' }, 'Tengo hambre.', ['tengo'])).toBe(true);
    expect(sentenceContainsLemma({ es: 'hablar', pos: 'verb' }, '¿Hablas español?')).toBe(true);
    expect(sentenceContainsLemma({ es: 'casa', pos: 'noun' }, 'Me gusta el coche.')).toBe(false);
  });

  it('liest den Rangbereich aus dem Dateinamen', () => {
    expect(rangeFromFileName('words-0001-0300.json')).toEqual([1, 300]);
    expect(rangeFromFileName('paket1.json')).toBeNull();
  });
});

describe('Paketprüfung', () => {
  it('fehlerfreies Paket', () => {
    expect(checkPackage('words-0001-0003.json', pkg(), ranking)).toEqual([]);
  });

  it('Fehler: Pflichtfelder, Artikel bei Nicht-Nomen, Satzlänge, deAlt', () => {
    const words = pkg();
    words[0] = word({ de: '' });
    words[1] = { ...words[1]!, article: 'el' };
    words[2] = { ...words[2]!, exampleEs: 'uno dos tres cuatro cinco seis siete ocho nueve diez once rápido', deAlt: ['a', 'b', 'c'] };
    const msgs = errors(checkPackage('words-0001-0003.json', words, ranking));
    expect(msgs).toContain('Pflichtfeld de fehlt');
    expect(msgs).toContain('article nur bei Nomen');
    expect(msgs).toContain('Beispielsatz hat mehr als 10 Wörter');
    expect(msgs).toContain('deAlt hat mehr als 2 Einträge');
  });

  it('Fehler: rank oder freqShare stimmen nicht mit der Rangliste überein', () => {
    const words = pkg();
    words[0] = word({ es: 'coche' });
    words[1] = { ...words[1]!, freqShare: 0.0021 };
    const msgs = errors(checkPackage('words-0001-0003.json', words, ranking));
    expect(msgs.some((m) => m.includes('ist in der Rangliste „casa“'))).toBe(true);
    expect(msgs).toContain('freqShare weicht von der Rangliste ab');
  });

  it('Fehler: Paketgröße und Rangbereich passen nicht zum Dateinamen', () => {
    const msgs = errors(checkPackage('words-0001-0300.json', pkg(), ranking));
    expect(msgs).toContain('enthält 3 Einträge, erwartet 300');
    expect(errors(checkPackage('words-0002-0004.json', pkg(), ranking))).toContain('Rang 1 passt nicht zu words-0002-0004.json');
  });

  it('Warnung, wenn das Lemma im Beispielsatz fehlt', () => {
    const words = pkg();
    words[0] = word({ exampleEs: 'Me gusta el coche.' });
    const f = checkPackage('words-0001-0003.json', words, ranking);
    expect(f).toEqual([{ level: 'warning', id: 'w0001', message: '„casa“ kommt im Beispielsatz nicht erkennbar vor' }]);
  });
});

describe('Gesamtprüfung aller Pakete', () => {
  it('id und rank eindeutig und lückenlos, freqShare nie steigend (Gleichstand erlaubt)', () => {
    expect(checkAll(pkg())).toEqual([]);
    const dup = [...pkg(), word({ id: 'w0001', rank: 5, freqShare: 0.001 })];
    const msgs = checkAll(dup).map((f) => f.message);
    expect(msgs).toContain('id doppelt');
    expect(msgs.some((m) => m.startsWith('Ränge nicht lückenlos'))).toBe(true);
    const rising = pkg();
    rising[2] = { ...rising[2]!, freqShare: 0.0025 };
    expect(checkAll(rising).map((f) => f.message)).toContain('freqShare steigt gegenüber dem vorherigen Rang');
  });
});
