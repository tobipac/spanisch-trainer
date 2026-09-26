// Sprachausgabe mit der Stimme des Handys (speechSynthesis, SPEC.md Abschnitt 6).
// Die App bleibt ohne Audio voll nutzbar: alle Funktionen sind stille No-ops, wenn nichts verfügbar ist.
import { chooseVoice } from './voices.ts';

const synth = (): SpeechSynthesis | undefined =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

let voices: SpeechSynthesisVoice[] = [];

function loadVoices(): void {
  voices = synth()?.getVoices() ?? [];
}

// iOS lädt die Stimmen verzögert: erst nach „voiceschanged“ auslesen.
const s = synth();
if (s) {
  loadVoices();
  s.addEventListener?.('voiceschanged', loadVoices);
}

export function availableVoices(): SpeechSynthesisVoice[] {
  return voices;
}

export function hasSpanishVoice(): boolean {
  return chooseVoice(voices) !== undefined;
}

/**
 * iOS gibt Audio erst nach einer Nutzerberührung frei. Aufruf direkt im Tap-Handler
 * (z. B. „Lernen starten“) mit einer leeren Äußerung entsperrt die Sprachausgabe.
 */
export function unlockAudio(): void {
  const sy = synth();
  if (!sy) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  sy.speak(u);
}

export interface SpeakOptions {
  rate: number;
  voiceURI?: string;
}

export function speak(text: string, { rate, voiceURI }: SpeakOptions): void {
  const sy = synth();
  if (!sy || !text) return;
  if (voices.length === 0) loadVoices();
  const voice = chooseVoice(voices, voiceURI);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'es-ES';
  if (voice) u.voice = voice;
  u.rate = rate;
  sy.cancel(); // laufende Ausgabe abbrechen, damit schnelle Taps nicht nachhallen
  sy.speak(u);
}
