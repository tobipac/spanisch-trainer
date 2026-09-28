// Ergänzt den Formenblock (`forms`) in Wortpaketen. Aufruf: npm run build:forms -- words-0001-0300.json
// Ändert nur Einträge ohne `forms`; id, rank und alle anderen Felder bleiben unverändert.
//  - heard:   bis zu 3 Formen aus topForms der Rangliste (Verben und veränderliche Adjektive, nicht nur das Lemma)
//  - present: regelmäßig nach Muster, unregelmäßige Verben aus IRREGULAR_PRESENT (von Hand gepflegt)
//  - adj:     Adjektive auf -o (bueno, buena, buenos, buenas)
//  - plural:  nur Nomen aus IRREGULAR_PLURAL
import { readFileSync, writeFileSync } from 'node:fs';
import { irregularIndices, regularPresent } from '../src/domain/forms.ts';
import type { Word, WordForms } from '../src/domain/types.ts';
import { MAX_HEARD, parseRanking } from './lib/word-checks.ts';

/** Präsens unregelmäßiger Verben (yo, tú, él, nosotros, vosotros, ellos), Spanien. */
const IRREGULAR_PRESENT: Record<string, string> = {
  ser: 'soy eres es somos sois son',
  estar: 'estoy estás está estamos estáis están',
  haber: 'he has ha hemos habéis han',
  tener: 'tengo tienes tiene tenemos tenéis tienen',
  ir: 'voy vas va vamos vais van',
  hacer: 'hago haces hace hacemos hacéis hacen',
  poder: 'puedo puedes puede podemos podéis pueden',
  decir: 'digo dices dice decimos decís dicen',
  saber: 'sé sabes sabe sabemos sabéis saben',
  querer: 'quiero quieres quiere queremos queréis quieren',
  ver: 'veo ves ve vemos veis ven',
  dar: 'doy das da damos dais dan',
  venir: 'vengo vienes viene venimos venís vienen',
  sentir: 'siento sientes siente sentimos sentís sienten',
  encontrar: 'encuentro encuentras encuentra encontramos encontráis encuentran',
  pensar: 'pienso piensas piensa pensamos pensáis piensan',
  volver: 'vuelvo vuelves vuelve volvemos volvéis vuelven',
  poner: 'pongo pones pone ponemos ponéis ponen',
  parecer: 'parezco pareces parece parecemos parecéis parecen',
  salir: 'salgo sales sale salimos salís salen',
  seguir: 'sigo sigues sigue seguimos seguís siguen',
  oír: 'oigo oyes oye oímos oís oyen',
  conocer: 'conozco conoces conoce conocemos conocéis conocen',
  contar: 'cuento cuentas cuenta contamos contáis cuentan',
  perder: 'pierdo pierdes pierde perdemos perdéis pierden',
  entender: 'entiendo entiendes entiende entendemos entendéis entienden',
  morir: 'muero mueres muere morimos morís mueren',
  recordar: 'recuerdo recuerdas recuerda recordamos recordáis recuerdan',
  empezar: 'empiezo empiezas empieza empezamos empezáis empiezan',
  pedir: 'pido pides pide pedimos pedís piden',
  conseguir: 'consigo consigues consigue conseguimos conseguís consiguen',
  traer: 'traigo traes trae traemos traéis traen',
  comenzar: 'comienzo comienzas comienza comenzamos comenzáis comienzan',
  suponer: 'supongo supones supone suponemos suponéis suponen',
  mantener: 'mantengo mantienes mantiene mantenemos mantenéis mantienen',
  mostrar: 'muestro muestras muestra mostramos mostráis muestran',
  jugar: 'juego juegas juega jugamos jugáis juegan',
  convertir: 'convierto conviertes convierte convertimos convertís convierten',
};

/** Unregelmäßiger Plural (Akzent- oder Schreibänderung, unveränderlich). */
const IRREGULAR_PLURAL: Record<string, string> = {
  vez: 'veces',
  razón: 'razones',
  millón: 'millones',
  joven: 'jóvenes',
};

export function formsFor(w: Word, topForms: string[]): WordForms | undefined {
  const forms: WordForms = {};
  const variableAdj = w.pos === 'adj' && w.es.endsWith('o');
  if (w.pos === 'verb' || variableAdj) {
    const heard = topForms.slice(0, MAX_HEARD);
    if (heard.some((f) => f !== w.es)) forms.heard = heard;
  }
  if (w.pos === 'verb') {
    const present = IRREGULAR_PRESENT[w.es]?.split(' ') ?? regularPresent(w.es);
    if (!present) throw new Error(`${w.id}: kein Präsens für „${w.es}“`);
    forms.present = present;
    const irregular = irregularIndices(w.es, present);
    if (irregular.length > 0) forms.irregular = irregular;
  }
  if (variableAdj) {
    const stem = w.es.slice(0, -1);
    forms.adj = [w.es, `${stem}a`, `${w.es}s`, `${stem}as`];
  }
  if (w.pos === 'noun' && IRREGULAR_PLURAL[w.es]) forms.plural = IRREGULAR_PLURAL[w.es];
  return Object.keys(forms).length > 0 ? forms : undefined;
}

/** Eine Zeile pro Eintrag, Format wie in den bestehenden Paketen: {"id": "w0001", "rank": 1, …}. */
export function formatValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${formatValue(x)}`).join(', ')}}`;
  }
  return JSON.stringify(v);
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Aufruf: npm run build:forms -- words-0001-0300.json [weitere Pakete]');
    process.exit(1);
  }
  const ranking = new Map(
    parseRanking(readFileSync(new URL('../data/ranking/lemma-ranking.csv', import.meta.url), 'utf-8')).map((r) => [r.rank, r]),
  );
  for (const file of files) {
    const url = new URL(`../data/words/${file}`, import.meta.url);
    const words = JSON.parse(readFileSync(url, 'utf-8')) as Word[];
    let added = 0;
    const out = words.map((w) => {
      if (w.forms) return w;
      const forms = formsFor(w, ranking.get(w.rank)?.topForms ?? []);
      if (!forms) return w;
      added++;
      return { ...w, forms };
    });
    writeFileSync(url, `[\n${out.map((w) => `  ${formatValue(w)}`).join(',\n')}\n]\n`, 'utf-8');
    console.log(`${file}: forms bei ${added} Einträgen ergänzt.`);
  }
}
