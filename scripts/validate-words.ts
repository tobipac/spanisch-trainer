// Prüfskript für die Wortpakete (SPEC.md Abschnitt 8.3). Aufruf: npm run validate:words
// Fehler → Exit-Code 1. Warnungen werden nur ausgegeben.
import { readdirSync, readFileSync } from 'node:fs';
import type { Word } from '../src/domain/types.ts';
import { checkAll, checkPackage, parseRanking, type Finding } from './lib/word-checks.ts';

const wordsDir = new URL('../data/words/', import.meta.url);
const rankingFile = new URL('../data/ranking/lemma-ranking.csv', import.meta.url);

const ranking = new Map(parseRanking(readFileSync(rankingFile, 'utf-8')).map((r) => [r.rank, r]));
const files = readdirSync(wordsDir).filter((f) => /^words-\d{4}-\d{4}\.json$/.test(f)).sort();

if (files.length === 0) {
  console.log('Keine Wortpakete in data/words/ – nichts zu prüfen.');
  process.exit(0);
}

const findings: Finding[] = [];
const all: Word[] = [];
for (const file of files) {
  const words = JSON.parse(readFileSync(new URL(file, wordsDir), 'utf-8')) as Word[];
  all.push(...words);
  findings.push(...checkPackage(file, words, ranking));
}
findings.push(...checkAll(all));

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warning');
for (const f of warnings) console.warn(`Warnung ${f.id}: ${f.message}`);
for (const f of errors) console.error(`FEHLER  ${f.id}: ${f.message}`);
console.log(`${files.length} Paket(e), ${all.length} Wörter, ${errors.length} Fehler, ${warnings.length} Warnungen.`);
process.exit(errors.length > 0 ? 1 : 0);
