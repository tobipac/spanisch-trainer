import { describe, expect, it } from 'vitest';
import { chooseVoice, spanishVoices, type VoiceInfo } from '../src/audio/voices.ts';

const v = (name: string, lang: string, voiceURI = name): VoiceInfo => ({ name, lang, voiceURI });

const monica = v('Mónica', 'es-ES');
const monicaCompact = v('Mónica (compact)', 'es-ES', 'com.apple.voice.compact.es-ES.Monica');
const paulina = v('Paulina', 'es-MX');
const argentina = v('Diego', 'es-AR');
const anna = v('Anna', 'de-DE');

describe('Stimmenwahl', () => {
  it('1. gespeicherte Stimme hat Vorrang', () => {
    expect(chooseVoice([monica, paulina], 'Paulina')).toBe(paulina);
  });

  it('gespeicherte, aber nicht mehr vorhandene Stimme → normale Reihenfolge', () => {
    expect(chooseVoice([monica, paulina], 'weg')).toBe(monica);
  });

  it('2. es-ES ohne compact vor compact', () => {
    expect(chooseVoice([monicaCompact, monica])).toBe(monica);
  });

  it('3. es-ES auch als compact vor es-MX', () => {
    expect(chooseVoice([paulina, monicaCompact])).toBe(monicaCompact);
  });

  it('4. es-MX vor anderen spanischen Varianten', () => {
    expect(chooseVoice([argentina, paulina])).toBe(paulina);
  });

  it('5. irgendeine spanische Stimme, Unterstrich-Schreibweise wird erkannt', () => {
    expect(chooseVoice([anna, argentina])).toBe(argentina);
    const android = v('Spanish', 'es_ES');
    expect(chooseVoice([anna, android])).toBe(android);
  });

  it('keine spanische Stimme → undefined', () => {
    expect(chooseVoice([anna])).toBeUndefined();
    expect(chooseVoice([])).toBeUndefined();
  });

  it('Auswahlliste: nur Spanisch, es-ES zuerst', () => {
    expect(spanishVoices([anna, argentina, paulina, monica]).map((x) => x.name)).toEqual(['Mónica', 'Paulina', 'Diego']);
  });
});
