// Stimmenwahl für die Sprachausgabe (SPEC.md Abschnitt 6). Reine Logik, getestet.

/** Das Nötigste aus SpeechSynthesisVoice – so auch ohne Browser testbar. */
export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase();
const isCompact = (v: VoiceInfo) => /compact/i.test(v.name) || /compact/i.test(v.voiceURI);

/**
 * Priorität: 1. gespeicherte Stimme, 2. es-ES ohne „compact“, 3. es-ES, 4. es-MX, 5. es-*.
 * Liefert undefined, wenn keine spanische Stimme vorhanden ist.
 */
export function chooseVoice<V extends VoiceInfo>(voices: readonly V[], savedURI?: string): V | undefined {
  const saved = savedURI ? voices.find((v) => v.voiceURI === savedURI) : undefined;
  if (saved) return saved;
  const esES = voices.filter((v) => norm(v.lang) === 'es-es');
  return (
    esES.find((v) => !isCompact(v)) ??
    esES[0] ??
    voices.find((v) => norm(v.lang) === 'es-mx') ??
    voices.find((v) => norm(v.lang).startsWith('es'))
  );
}

/** Alle spanischen Stimmen für die Auswahl in den Einstellungen (es-ES zuerst). */
export function spanishVoices<V extends VoiceInfo>(voices: readonly V[]): V[] {
  const rank = (v: V) => (norm(v.lang) === 'es-es' ? 0 : norm(v.lang) === 'es-mx' ? 1 : 2);
  return voices.filter((v) => norm(v.lang).startsWith('es')).sort((a, b) => rank(a) - rank(b));
}
