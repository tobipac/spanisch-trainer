// UI-Beschriftungen, die an mehreren Stellen gebraucht werden.
import type { PartOfSpeech, Rating } from '../domain/types.ts';

export const POS_LABELS: Record<PartOfSpeech, string> = {
  noun: 'Nomen',
  verb: 'Verb',
  adj: 'Adjektiv',
  adv: 'Adverb',
  pron: 'Pronomen',
  prep: 'Präposition',
  conj: 'Konjunktion',
  det: 'Begleiter',
  num: 'Zahlwort',
  interj: 'Ausruf',
  other: 'sonstiges',
};

/** Lemmata mit Wortart „det“, die als „Artikel“ statt „Begleiter“ angezeigt werden. */
export const ARTICLE_LEMMAS: readonly string[] = ['el', 'uno'];

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Nochmal',
  2: 'Schwer',
  3: 'Gut',
  4: 'Leicht',
};

/** Wischweg in Pixeln, ab dem eine Wischgeste als Bewertung zählt. */
export const SWIPE_THRESHOLD_PX = 100;

/** Dauer der Karten-Animationen (SPEC: unter 300 ms). */
export const CARD_ANIMATION_S = 0.22;

/** Seitenwechsel im Onboarding: Aus- und Einblenden laufen nacheinander, zusammen unter 300 ms. */
export const ONBOARDING_TRANSITION_S = 0.14;
