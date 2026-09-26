// Erzeugt je Wortpaket eine Stichprobe zur Kontrolle durch den Nutzer (SPEC.md Abschnitt 8.3).
// 20 zufällige Einträge (reproduzierbar je Paket) plus alle mehrdeutigen (max. 15).
// Aufruf: npm run sample:words  → data/words/samples/<paket>-stichprobe.md
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Word } from '../src/domain/types.ts';
import { parseRanking } from './lib/word-checks.ts';

const RANDOM_COUNT = 20;
const MAX_AMBIGUOUS = 15;

const wordsDir = new URL('../data/words/', import.meta.url);
const outDir = new URL('../data/words/samples/', import.meta.url);
const ranking = parseRanking(readFileSync(new URL('../data/ranking/lemma-ranking.csv', import.meta.url), 'utf-8'));
const ambiguousRanks = new Set(ranking.filter((r) => r.ambiguous).map((r) => r.rank));

/** Kleiner deterministischer Zufallsgenerator (mulberry32), Startwert aus dem Paketnamen. */
function random(seedText: string): () => number {
  let seed = [...seedText].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cell = (s: string | undefined) => (s ?? '').replace(/\|/g, '\\|');

mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(wordsDir).filter((f) => /^words-\d{4}-\d{4}\.json$/.test(f)).sort()) {
  const words = JSON.parse(readFileSync(new URL(file, wordsDir), 'utf-8')) as Word[];
  const ambiguous = words.filter((w) => ambiguousRanks.has(w.rank)).slice(0, MAX_AMBIGUOUS);
  const rest = words.filter((w) => !ambiguous.includes(w));
  const rnd = random(file);
  const picked: Word[] = [];
  while (picked.length < Math.min(RANDOM_COUNT, rest.length)) {
    const w = rest[Math.floor(rnd() * rest.length)]!;
    if (!picked.includes(w)) picked.push(w);
  }
  const rows = [...picked, ...ambiguous].sort((a, b) => a.rank - b.rank);
  const name = file.replace('.json', '');
  const lines = [
    `# Stichprobe ${name}`,
    '',
    `${picked.length} zufällige Einträge und ${ambiguous.length} mehrdeutige Grundformen (⚑). Bitte prüfen und in der letzten Spalte anmerken.`,
    '',
    '| Rang | Lemma | Deutsch | Beispielsatz | Beispielsatz Deutsch | Anmerkung Nutzer |',
    '|---:|---|---|---|---|---|',
    ...rows.map((w) => {
      const es = `${w.article ? w.article + ' ' : ''}${w.es}${ambiguous.includes(w) ? ' ⚑' : ''}`;
      const de = [w.de, ...(w.deAlt ?? [])].join('; ') + (w.note ? ` _(${w.note})_` : '');
      return `| ${w.rank} | ${cell(es)} | ${cell(de)} | ${cell(w.exampleEs)} | ${cell(w.exampleDe)} |  |`;
    }),
  ];
  writeFileSync(new URL(`${name}-stichprobe.md`, outDir), lines.join('\n') + '\n', 'utf-8');
  console.log(`data/words/samples/${name}-stichprobe.md (${rows.length} Einträge)`);
}
