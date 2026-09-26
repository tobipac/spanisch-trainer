// Erzeugt src/config/coverage.ts (Abdeckungstabelle) aus data/ranking/lemma-ranking.csv.
// Aufruf: npm run build:coverage – nach jeder Änderung der Rangliste. tests/coverage.test.ts prüft die Übereinstimmung.
import { readFileSync, writeFileSync } from 'node:fs';
import { BANDS } from '../src/config/progress.ts';
import { parseRanking } from './lib/word-checks.ts';

const rows = parseRanking(readFileSync(new URL('../data/ranking/lemma-ranking.csv', import.meta.url), 'utf-8'));
const share = (from: number, to: number) =>
  rows.filter((r) => r.rank >= from && r.rank <= to).reduce((s, r) => s + r.freqShare, 0);

const top = BANDS[BANDS.length - 1]![1];
const bandShares = BANDS.map(([a, b]) => share(a, b));
const round = (x: number) => Math.round(x * 1e8) / 1e8;

const out = `// ERZEUGT von scripts/build-coverage.ts aus data/ranking/lemma-ranking.csv – nicht von Hand ändern.

/** Maximal erreichbare Abdeckung, wenn alle Wörter bis Rang ${top} gefestigt sind (Summe freqShare). */
export const MAX_COVERAGE = ${round(share(1, top))};

/** Summe freqShare je Band (Reihenfolge wie BANDS in progress.ts). */
export const BAND_COVERAGE: readonly number[] = [${bandShares.map(round).join(', ')}];
`;
writeFileSync(new URL('../src/config/coverage.ts', import.meta.url), out, 'utf-8');
console.log(`src/config/coverage.ts: MAX_COVERAGE = ${(share(1, top) * 100).toFixed(2)} %`);
