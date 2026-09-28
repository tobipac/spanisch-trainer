// Ergänzt den Formenblock (`forms`) in Wortpaketen. Aufruf: npm run build:forms -- words-0001-0300.json
// Ändert nur Einträge ohne `forms`; id, rank und alle anderen Felder bleiben unverändert.
//  - heard:   bis zu 3 Formen aus topForms der Rangliste (Verben und veränderliche Adjektive, nicht nur das Lemma)
//  - present: regelmäßig nach Muster, unregelmäßige Verben aus IRREGULAR_PRESENT (von Hand gepflegt)
//  - gender4: veränderliche Adjektive (adjGender4) und Begleiter/Pronomen aus GENDER4_WORDS
//  - stemChange: Stammwechsel aus dem Präsens abgeleitet (o → ue, e → ie, e → i, u → ue)
//  - irregularKind: nur Akzent- oder Schreibänderung statt echter Unregelmäßigkeit
//  - plural:  nur wenn abweichend von +s/+es (spellingPlural, STRESS_SHIFT_PLURAL)
import { readFileSync, writeFileSync } from 'node:fs';
import {
  adjGender4,
  irregularIndices,
  irregularKind,
  regularPlural,
  regularPresent,
  spellingPlural,
  stemChange,
} from '../src/domain/forms.ts';
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
  // Paket 2
  caer: 'caigo caes cae caemos caéis caen',
  enviar: 'envío envías envía enviamos enviáis envían',
  mover: 'muevo mueves mueve movemos movéis mueven',
  dormir: 'duermo duermes duerme dormimos dormís duermen',
  aparecer: 'aparezco apareces aparece aparecemos aparecéis aparecen',
  continuar: 'continúo continúas continúa continuamos continuáis continúan',
  obtener: 'obtengo obtienes obtiene obtenemos obtenéis obtienen',
  detener: 'detengo detienes detiene detenemos detenéis detienen',
  incluir: 'incluyo incluyes incluye incluimos incluís incluyen',
  ofrecer: 'ofrezco ofreces ofrece ofrecemos ofrecéis ofrecen',
  servir: 'sirvo sirves sirve servimos servís sirven',
  sentar: 'siento sientas sienta sentamos sentáis sientan',
  valer: 'valgo vales vale valemos valéis valen',
  cerrar: 'cierro cierras cierra cerramos cerráis cierran',
  coger: 'cojo coges coge cogemos cogéis cogen',
  referir: 'refiero refieres refiere referimos referís refieren',
  sonar: 'sueno suenas suena sonamos sonáis suenan',
  confiar: 'confío confías confía confiamos confiáis confían',
  reconocer: 'reconozco reconoces reconoce reconocemos reconocéis reconocen',
  producir: 'produzco produces produce producimos producís producen',
  // Paket 3
  actuar: 'actúo actúas actúa actuamos actuáis actúan',
  despertar: 'despierto despiertas despierta despertamos despertáis despiertan',
  elegir: 'elijo eliges elige elegimos elegís eligen',
  proteger: 'protejo proteges protege protegemos protegéis protegen',
  dirigir: 'dirijo diriges dirige dirigimos dirigís dirigen',
  soler: 'suelo sueles suele solemos soléis suelen',
  construir: 'construyo construyes construye construimos construís construyen',
  probar: 'pruebo pruebas prueba probamos probáis prueban',
  reunir: 'reúno reúnes reúne reunimos reunís reúnen',
  crecer: 'crezco creces crece crecemos crecéis crecen',
  conducir: 'conduzco conduces conduce conducimos conducís conducen',
  volar: 'vuelo vuelas vuela volamos voláis vuelan',
  mentir: 'miento mientes miente mentimos mentís mienten',
  desaparecer: 'desaparezco desapareces desaparece desaparecemos desaparecéis desaparecen',
  preferir: 'prefiero prefieres prefiere preferimos preferís prefieren',
  recoger: 'recojo recoges recoge recogemos recogéis recogen',
  permanecer: 'permanezco permaneces permanece permanecemos permanecéis permanecen',
  resolver: 'resuelvo resuelves resuelve resolvemos resolvéis resuelven',
  huir: 'huyo huyes huye huimos huis huyen',
  demostrar: 'demuestro demuestras demuestra demostramos demostráis demuestran',
  agradecer: 'agradezco agradeces agradece agradecemos agradecéis agradecen',
  destruir: 'destruyo destruyes destruye destruimos destruís destruyen',
  merecer: 'merezco mereces merece merecemos merecéis merecen',
  devolver: 'devuelvo devuelves devuelve devolvemos devolvéis devuelven',
  // Paket 4
  nacer: 'nazco naces nace nacemos nacéis nacen',
  establecer: 'establezco estableces establece establecemos establecéis establecen',
  costar: 'cuesto cuestas cuesta costamos costáis cuestan',
  defender: 'defiendo defiendes defiende defendemos defendéis defienden',
  negar: 'niego niegas niega negamos negáis niegan',
  acordar: 'acuerdo acuerdas acuerda acordamos acordáis acuerdan',
  pertenecer: 'pertenezco perteneces pertenece pertenecemos pertenecéis pertenecen',
  contener: 'contengo contienes contiene contenemos contenéis contienen',
  requerir: 'requiero requieres requiere requerimos requerís requieren',
  sostener: 'sostengo sostienes sostiene sostenemos sostenéis sostienen',
  doler: 'duelo dueles duele dolemos doléis duelen',
  soltar: 'suelto sueltas suelta soltamos soltáis sueltan',
  sugerir: 'sugiero sugieres sugiere sugerimos sugerís sugieren',
  repetir: 'repito repites repite repetimos repetís repiten',
  reducir: 'reduzco reduces reduce reducimos reducís reducen',
  // Paket 5
  reír: 'río ríes ríe reímos reís ríen',
  divertir: 'divierto diviertes divierte divertimos divertís divierten',
  apostar: 'apuesto apuestas apuesta apostamos apostáis apuestan',
  proponer: 'propongo propones propone proponemos proponéis proponen',
  comprobar: 'compruebo compruebas comprueba comprobamos comprobáis comprueban',
  despedir: 'despido despides despide despedimos despedís despiden',
  advertir: 'advierto adviertes advierte advertimos advertís advierten',
  aprobar: 'apruebo apruebas aprueba aprobamos aprobáis aprueban',
  oler: 'huelo hueles huele olemos oléis huelen',
  rendir: 'rindo rindes rinde rendimos rendís rinden',
  atender: 'atiendo atiendes atiende atendemos atendéis atienden',
  convencer: 'convenzo convences convence convencemos convencéis convencen',
  vencer: 'venzo vences vence vencemos vencéis vencen',
  acostar: 'acuesto acuestas acuesta acostamos acostáis acuestan',
};

/** Begleiter und Pronomen mit 4 Formen: m. Sg., f. Sg., m. Pl., f. Pl. */
const GENDER4_WORDS: Record<string, string> = {
  el: 'el la los las',
  uno: 'un una unos unas',
  este: 'este esta estos estas',
  ese: 'ese esa esos esas',
  aquel: 'aquel aquella aquellos aquellas',
  todo: 'todo toda todos todas',
  otro: 'otro otra otros otras',
  mucho: 'mucho mucha muchos muchas',
  alguno: 'alguno alguna algunos algunas',
  ninguno: 'ninguno ninguna ningunos ningunas',
  mismo: 'mismo misma mismos mismas',
  nuestro: 'nuestro nuestra nuestros nuestras',
  vuestro: 'vuestro vuestra vuestros vuestras',
  mío: 'mío mía míos mías',
  tuyo: 'tuyo tuya tuyos tuyas',
  suyo: 'suyo suya suyos suyas',
  cuánto: 'cuánto cuánta cuántos cuántas',
  cuyo: 'cuyo cuya cuyos cuyas',
};

/** Plural mit Akzentverschiebung (nicht per Regel ableitbar). */
const STRESS_SHIFT_PLURAL: Record<string, string> = {
  joven: 'jóvenes',
  orden: 'órdenes',
  imagen: 'imágenes',
  examen: 'exámenes',
  crimen: 'crímenes',
  origen: 'orígenes',
  margen: 'márgenes',
  volumen: 'volúmenes',
};
/** Nomen ohne Plural-Block: nur in festen Wendungen oder Plural im Alltag praktisch ungebräuchlich. */
const NO_PLURAL = new Set(['través', 'veras', 'paz', 'educación', 'perdón']);

export function formsFor(w: Word, topForms: string[]): WordForms | undefined {
  const forms: WordForms = {};
  const gender4 =
    w.pos === 'adj' ? adjGender4(w.es) : ['det', 'pron'].includes(w.pos) ? GENDER4_WORDS[w.es]?.split(' ') : undefined;
  if (w.pos === 'verb' || (w.pos === 'adj' && gender4)) {
    const heard = topForms.slice(0, MAX_HEARD);
    if (heard.some((f) => f !== w.es)) forms.heard = heard;
  }
  if (w.pos === 'verb') {
    const present = IRREGULAR_PRESENT[w.es]?.split(' ') ?? regularPresent(w.es);
    if (!present) throw new Error(`${w.id}: kein Präsens für „${w.es}“`);
    forms.present = present;
    const irregular = irregularIndices(w.es, present);
    if (irregular.length > 0) forms.irregular = irregular;
    const kind = irregularKind(w.es, present);
    if (kind) forms.irregularKind = kind;
    const change = stemChange(w.es, present);
    if (change) forms.stemChange = change;
  }
  if (gender4) forms.gender4 = gender4;
  if (w.pos === 'noun' && !NO_PLURAL.has(w.es)) {
    const plural = STRESS_SHIFT_PLURAL[w.es] ?? spellingPlural(w.es);
    if (plural !== regularPlural(w.es)) forms.plural = plural;
  }
  return Object.keys(forms).length > 0 ? forms : undefined;
}

/** Eine Zeile pro Eintrag, Format wie in den bestehenden Paketen: {"id": "w0001", "rank": 1, …}. */
export function formatValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${formatValue(x)}`).join(', ')}}`;
  }
  // Zahlen wie in den ursprünglich mit Python erzeugten Paketen: unter 1e-4 wissenschaftlich (7.121e-05)
  if (typeof v === 'number' && v !== 0 && Math.abs(v) < 1e-4) {
    return v.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
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
