// Wortpakete aus data/words/ – werden beim Build eingebunden und vom Service Worker vorab gespeichert.
import type { Word, WordRef } from '../domain/types.ts';

const packages = import.meta.glob<Word[]>('../../data/words/words-*.json', { eager: true, import: 'default' });

export const WORDS: Word[] = Object.values(packages)
  .flat()
  .sort((a, b) => a.rank - b.rank);

export const WORD_BY_ID: ReadonlyMap<string, Word> = new Map(WORDS.map((w) => [w.id, w]));

export const WORD_REFS: WordRef[] = WORDS.map(({ id, rank }) => ({ id, rank }));
