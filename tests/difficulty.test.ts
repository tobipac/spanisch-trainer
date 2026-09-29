import { describe, expect, it } from 'vitest';
import { PROBLEM_CARD_AGAIN_MIN, WEAK_WORD_AGAIN_MIN, WEAK_WORD_WINDOW_DAYS } from '../src/config/learning.ts';
import { againCounts, isProblemCard, problemCards, weakWordIds, wordIdOfCard } from '../src/domain/difficulty.ts';
import type { Rating, ReviewLogRecord } from '../src/domain/types.ts';
import { at } from './helpers.ts';

const NOW = at(2026, 10, 1, 10);
const DAY = 86_400_000;
const log = (cardId: string, rating: Rating, daysAgo = 1): ReviewLogRecord =>
  ({ cardId, rating, reviewedAt: NOW.getTime() - daysAgo * DAY }) as ReviewLogRecord;
const times = (n: number, cardId: string, rating: Rating = 1, daysAgo = 1) => Array.from({ length: n }, () => log(cardId, rating, daysAgo));

describe('Problemkarten', () => {
  it(`ab ${PROBLEM_CARD_AGAIN_MIN} × „Nochmal“ insgesamt, meiste zuerst`, () => {
    const logs = [
      ...times(PROBLEM_CARD_AGAIN_MIN - 1, 'a:es-de'),
      ...times(PROBLEM_CARD_AGAIN_MIN, 'b:es-de', 1, 400), // auch sehr alte zählen
      ...times(PROBLEM_CARD_AGAIN_MIN + 2, 'c:de-es'),
      ...times(20, 'd:es-de', 3), // „Gut“ zählt nicht
    ];
    expect(problemCards(logs)).toEqual([
      { cardId: 'c:de-es', again: PROBLEM_CARD_AGAIN_MIN + 2 },
      { cardId: 'b:es-de', again: PROBLEM_CARD_AGAIN_MIN },
    ]);
    expect(isProblemCard(PROBLEM_CARD_AGAIN_MIN - 1)).toBe(false);
    expect(againCounts(logs).get('d:es-de')).toBeUndefined();
  });

  it('Wort-ID aus der Karten-ID', () => {
    expect(wordIdOfCard('w0012:de-es')).toBe('w0012');
  });
});

describe('Schwache Wörter', () => {
  it(`mindestens ${WEAK_WORD_AGAIN_MIN} × „Nochmal“ in ${WEAK_WORD_WINDOW_DAYS} Tagen, beide Richtungen zusammen`, () => {
    const logs = [
      ...times(2, 'a:es-de'), log('a:de-es', 1), // 3 über beide Richtungen → schwach
      ...times(WEAK_WORD_AGAIN_MIN - 1, 'b:es-de'), // zu wenig
      ...times(WEAK_WORD_AGAIN_MIN, 'c:es-de', 1, WEAK_WORD_WINDOW_DAYS + 1), // zu alt
      ...times(WEAK_WORD_AGAIN_MIN + 2, 'd:es-de'), // am schwächsten
    ];
    expect(weakWordIds(logs, NOW)).toEqual(['d', 'a']);
  });
});
