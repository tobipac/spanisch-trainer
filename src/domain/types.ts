// Datenmodell laut SPEC.md Abschnitt 3.
import type { Card, ReviewLog } from 'ts-fsrs';

export type Direction = 'es-de' | 'de-es';
export type Rating = 1 | 2 | 3 | 4; // Nochmal, Schwer, Gut, Leicht

export type PartOfSpeech =
  | 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'conj' | 'det' | 'num' | 'interj' | 'other';

export interface Word {
  id: string;
  rank: number;
  freqShare: number;
  es: string;
  article?: 'el' | 'la' | 'los' | 'las';
  pos: PartOfSpeech;
  de: string;
  deAlt?: string[];
  exampleEs: string;
  exampleDe: string;
  note?: string;
}

/** Für die Lernlogik reicht id + rank. */
export type WordRef = Pick<Word, 'id' | 'rank'>;

export interface CardRecord {
  id: string; // `${wordId}:${direction}`
  wordId: string;
  direction: Direction;
  fsrs: Card;
  introducedAt: number | null; // null = noch nie gezeigt
  queuedAt?: number; // nur de-es: seit wann in der Warteschlange
}

export interface ReviewLogRecord {
  id?: number;
  cardId: string;
  rating: Rating;
  reviewedAt: number;
  log: ReviewLog;
}

export interface DayRecord {
  day: string; // YYYY-MM-DD, Lerntag ab 04:00
  newDone: number;
  reverseDone: number;
  reviewsDone: number;
  goalReached: boolean;
  neutral: boolean;
  jokerUsed: boolean;
  xp: number;
  dueAtStartIds: string[];
}

export interface Settings {
  newPerDay: number;
  autoPlayAudio: boolean;
  voiceURI?: string;
  speechRate: number;
  lastBackupAt?: number;
  onboardingDone: boolean;
}
