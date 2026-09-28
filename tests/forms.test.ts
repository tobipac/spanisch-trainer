import { describe, expect, it } from 'vitest';
import {
  adjGender4,
  highlightForm,
  irregularIndices,
  irregularKind,
  regularPlural,
  regularPresent,
  regularPresentParts,
  spellingPlural,
  stemChange,
  verbClass,
} from '../src/domain/forms.ts';
import type { Word } from '../src/domain/types.ts';

const word = (w: Partial<Word> & Pick<Word, 'es' | 'pos'>) => w as Pick<Word, 'es' | 'pos' | 'forms'>;

describe('Präsensmuster', () => {
  it('erkennt die Konjugationsklasse, auch oír', () => {
    expect(verbClass('hablar')).toBe('ar');
    expect(verbClass('comer')).toBe('er');
    expect(verbClass('vivir')).toBe('ir');
    expect(verbClass('oír')).toBe('ir');
    expect(verbClass('casa')).toBeNull();
  });

  it('bildet das regelmäßige Präsens mit vosotros-Form', () => {
    expect(regularPresent('hablar')).toEqual(['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan']);
    expect(regularPresent('comer')).toEqual(['como', 'comes', 'come', 'comemos', 'coméis', 'comen']);
    expect(regularPresent('vivir')).toEqual(['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven']);
    expect(regularPresentParts('hablar')?.[4]).toEqual(['habl', 'áis']);
  });

  it('markiert nur die abweichenden Formen als unregelmäßig', () => {
    expect(irregularIndices('ser', ['soy', 'eres', 'es', 'somos', 'sois', 'son'])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(irregularIndices('tener', ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'])).toEqual([0, 1, 2, 5]);
    expect(irregularIndices('conocer', ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'])).toEqual([0]);
    expect(irregularIndices('hablar', regularPresent('hablar')!)).toEqual([]);
  });

  it('unterscheidet Akzent- und Schreibänderung von echter Unregelmäßigkeit', () => {
    expect(irregularKind('enviar', ['envío', 'envías', 'envía', 'enviamos', 'enviáis', 'envían'])).toBe('accent');
    expect(irregularKind('reunir', ['reúno', 'reúnes', 'reúne', 'reunimos', 'reunís', 'reúnen'])).toBe('accent');
    expect(irregularKind('proteger', ['protejo', 'proteges', 'protege', 'protegemos', 'protegéis', 'protegen'])).toBe('spelling');
    expect(irregularKind('vencer', ['venzo', 'vences', 'vence', 'vencemos', 'vencéis', 'vencen'])).toBe('spelling');
    expect(irregularKind('distinguir', ['distingo', 'distingues', 'distingue', 'distinguimos', 'distinguís', 'distinguen'])).toBe('spelling');
    expect(irregularKind('conocer', ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'])).toBeNull();
    expect(irregularKind('oír', ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'])).toBeNull();
    expect(irregularKind('hablar', regularPresent('hablar')!)).toBeNull();
  });

  it('erkennt den Stammwechsel an der él-Form', () => {
    expect(stemChange('poder', ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'])).toBe('o → ue');
    expect(stemChange('pensar', ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan'])).toBe('e → ie');
    expect(stemChange('pedir', ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'])).toBe('e → i');
    expect(stemChange('seguir', ['sigo', 'sigues', 'sigue', 'seguimos', 'seguís', 'siguen'])).toBe('e → i');
    expect(stemChange('jugar', ['juego', 'juegas', 'juega', 'jugamos', 'jugáis', 'juegan'])).toBe('u → ue');
    expect(stemChange('tener', ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'])).toBe('e → ie');
    expect(stemChange('ser', ['soy', 'eres', 'es', 'somos', 'sois', 'son'])).toBeNull();
    expect(stemChange('estar', ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'])).toBeNull();
    expect(stemChange('hablar', regularPresent('hablar')!)).toBeNull();
  });

  it('Plural nach Grundregel', () => {
    expect(regularPlural('casa')).toBe('casas');
    expect(regularPlural('papá')).toBe('papás');
    expect(regularPlural('mujer')).toBe('mujeres');
    expect(regularPlural('vez')).toBe('vezes'); // deshalb steht veces in forms.plural
  });

  it('Plural mit Schreibregeln', () => {
    expect(spellingPlural('vez')).toBe('veces');
    expect(spellingPlural('luz')).toBe('luces');
    expect(spellingPlural('canción')).toBe('canciones');
    expect(spellingPlural('autobús')).toBe('autobuses');
    expect(spellingPlural('país')).toBe('países');
    expect(spellingPlural('mes')).toBe('meses');
    expect(spellingPlural('casa')).toBe('casas');
    expect(spellingPlural('lunes')).toBe('lunes');
    expect(spellingPlural('análisis')).toBe('análisis');
    expect(spellingPlural('cumpleaños')).toBe('cumpleaños');
    expect(spellingPlural('gas')).toBe('gases');
    expect(spellingPlural('dios')).toBe('dioses');
  });
});

describe('4 Formen bei Adjektiven', () => {
  it('-o, -or, -án/-ín/-ón, -és und Nationalitäten auf Konsonant', () => {
    expect(adjGender4('bueno')).toEqual(['bueno', 'buena', 'buenos', 'buenas']);
    expect(adjGender4('trabajador')).toEqual(['trabajador', 'trabajadora', 'trabajadores', 'trabajadoras']);
    expect(adjGender4('alemán')).toEqual(['alemán', 'alemana', 'alemanes', 'alemanas']);
    expect(adjGender4('pequeñín')).toEqual(['pequeñín', 'pequeñina', 'pequeñines', 'pequeñinas']);
    expect(adjGender4('llorón')).toEqual(['llorón', 'llorona', 'llorones', 'lloronas']);
    expect(adjGender4('francés')).toEqual(['francés', 'francesa', 'franceses', 'francesas']);
    expect(adjGender4('español')).toEqual(['español', 'española', 'españoles', 'españolas']);
    expect(adjGender4('andaluz')).toEqual(['andaluz', 'andaluza', 'andaluces', 'andaluzas']);
  });

  it('keine 4 Formen, wenn nur Einzahl/Mehrzahl variiert', () => {
    for (const es of ['grande', 'mejor', 'mayor', 'superior', 'nacional', 'feliz', 'cortés', 'importante']) {
      expect(adjGender4(es)).toBeNull();
    }
  });
});

describe('Hervorhebung im Beispielsatz', () => {
  it('findet unregelmäßige Formen aus dem Präsens', () => {
    const ser = word({ es: 'ser', pos: 'verb', forms: { present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'] } });
    expect(highlightForm(ser, 'Mi hermana es médica.')).toEqual({ before: 'Mi hermana ', match: 'es', after: ' médica.' });
  });

  it('ignoriert Groß-/Kleinschreibung und Satzzeichen', () => {
    const hablar = word({ es: 'hablar', pos: 'verb', forms: { present: regularPresent('hablar')! } });
    expect(highlightForm(hablar, '¿Hablas inglés?')?.match).toBe('Hablas');
  });

  it('findet Adjektiv-, Genus- und Pluralformen', () => {
    const bueno = word({ es: 'bueno', pos: 'adj', forms: { gender4: ['bueno', 'buena', 'buenos', 'buenas'] } });
    expect(highlightForm(bueno, 'Es una buena idea.')?.match).toBe('buena');
    const el = word({ es: 'el', pos: 'det', forms: { gender4: ['el', 'la', 'los', 'las'] } });
    expect(highlightForm(el, 'Cierra la puerta.')?.match).toBe('la');
    expect(highlightForm(word({ es: 'año', pos: 'noun' }), 'Tengo treinta años.')?.match).toBe('años');
    expect(highlightForm(word({ es: 'vez', pos: 'noun', forms: { plural: 'veces' } }), 'A veces llueve.')?.match).toBe('veces');
  });

  it('greift sonst auf den Wortstamm zurück (ohne Akzente)', () => {
    expect(highlightForm(word({ es: 'intentar', pos: 'verb' }), 'Voy a intentarlo otra vez.')?.match).toBe('intentarlo');
    expect(highlightForm(word({ es: 'dejar', pos: 'verb' }), 'Déjame en paz.')?.match).toBe('Déjame');
  });

  it('liefert null, wenn nichts passt', () => {
    expect(highlightForm(word({ es: 'ir', pos: 'verb' }), 'Nos vemos.')).toBeNull();
  });
});
