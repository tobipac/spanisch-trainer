// Erzeugt je Wortpaket eine Stichprobe zur Kontrolle durch den Nutzer (SPEC.md Abschnitt 8.3).
// 20 zufällige Einträge (reproduzierbar je Paket) plus alle mehrdeutigen (max. 15), dazu – falls das
// Paket einen Formenblock hat – eine Auswahl von Einträgen mit Formen.
// Aufruf: npm run sample:words [-- words-0301-0600.json …]  → data/words/samples/<paket>-stichprobe.md
// Ohne Argument werden alle Pakete neu erzeugt.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { highlightForm, verbClass } from '../src/domain/forms.ts';
import type { Word } from '../src/domain/types.ts';
import { parseRanking } from './lib/word-checks.ts';

const RANDOM_COUNT = 20;
const MAX_AMBIGUOUS = 15;
/** Einträge mit Formenblock je Gruppe */
const FORMS_PICKS = { irregularVerb: 6, regularVerb: 3, gender4: 5, plural: 3 };

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

/** n Einträge reproduzierbar zufällig auswählen. */
function pick<T>(items: T[], n: number, rnd: () => number): T[] {
  const out: T[] = [];
  while (out.length < Math.min(n, items.length)) {
    const x = items[Math.floor(rnd() * items.length)]!;
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** Formenblock als Text; unregelmäßige Präsensformen fett. */
function formsText(w: Word): string {
  const f = w.forms!;
  const parts: string[] = [];
  if (f.present) {
    const irregular = new Set(f.irregular ?? []);
    const labels = irregular.size > 0 ? ['unregelmäßig', f.stemChange].filter(Boolean) : [`regelmäßig -${verbClass(w.es)}`];
    parts.push(`Präsens: ${f.present.map((p, i) => (irregular.has(i) ? `**${p}**` : p)).join(', ')} (${labels.join(', ')})`);
  }
  if (f.gender4) parts.push(`Formen: ${f.gender4.join(' · ')}`);
  if (f.plural) parts.push(`Plural: ${f.plural}`);
  if (f.heard) parts.push(`häufig gehört: ${f.heard.join(', ')}`);
  return parts.join('<br>');
}

/** Beispielsatz mit hervorgehobener Form. */
function highlighted(w: Word): string {
  const h = highlightForm(w, w.exampleEs);
  return h ? `${h.before}**${h.match}**${h.after}` : `${w.exampleEs} _(keine Form erkannt)_`;
}

mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2);
const files = readdirSync(wordsDir).filter((f) => /^words-\d{4}-\d{4}\.json$/.test(f) && (only.length === 0 || only.includes(f)));
if (files.length === 0) {
  console.error(`Kein passendes Wortpaket: ${only.join(', ')}`);
  process.exit(1);
}
for (const file of files.sort()) {
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
  const withForms = words.filter((w) => w.forms);
  if (withForms.length > 0) {
    const frnd = random(`${file}:forms`);
    const groups = {
      irregularVerb: withForms.filter((w) => (w.forms!.irregular?.length ?? 0) > 0),
      regularVerb: withForms.filter((w) => w.forms!.present && !w.forms!.irregular),
      gender4: withForms.filter((w) => w.forms!.gender4),
      plural: withForms.filter((w) => w.forms!.plural),
    };
    const formRows = (Object.keys(groups) as Array<keyof typeof groups>)
      .flatMap((g) => pick(groups[g], FORMS_PICKS[g], frnd))
      .sort((a, b) => a.rank - b.rank);
    lines.push(
      '',
      '## Einträge mit Formenblock',
      '',
      `${formRows.length} von ${withForms.length} Einträgen mit Formen. Präsens: unregelmäßige Formen fett. Beispielsatz: hervorgehobene Form fett.`,
      '',
      '| Rang | Lemma | Formenblock | Beispielsatz | Hinweis | Anmerkung Nutzer |',
      '|---:|---|---|---|---|---|',
      ...formRows.map((w) => `| ${w.rank} | ${cell(w.es)} | ${cell(formsText(w))} | ${cell(highlighted(w))} | ${cell(w.note)} |  |`),
    );
  }
  writeFileSync(new URL(`${name}-stichprobe.md`, outDir), lines.join('\n') + '\n', 'utf-8');
  console.log(`data/words/samples/${name}-stichprobe.md (${rows.length} Einträge)`);
}
