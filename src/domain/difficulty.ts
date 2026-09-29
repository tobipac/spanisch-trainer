// Problemkarten und schwache Wörter aus den Review-Logs. Reine Logik, getestet.
import { PROBLEM_CARD_AGAIN_MIN, WEAK_WORD_AGAIN_MIN, WEAK_WORD_WINDOW_DAYS } from '../config/learning.ts';
import type { ReviewLogRecord } from './types.ts';

const DAY_MS = 86_400_000;

/** Wort-ID aus der Karten-ID `${wordId}:${direction}`. */
export const wordIdOfCard = (cardId: string) => cardId.slice(0, cardId.lastIndexOf(':'));

/** Anzahl „Nochmal“ je Karte (optional nur Bewertungen ab `since`). */
export function againCounts(logs: readonly ReviewLogRecord[], since = -Infinity): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of logs) {
    if (l.rating === 1 && l.reviewedAt >= since) out.set(l.cardId, (out.get(l.cardId) ?? 0) + 1);
  }
  return out;
}

export const isProblemCard = (againTotal: number) => againTotal >= PROBLEM_CARD_AGAIN_MIN;

/** Problemkarten: mindestens 8 „Nochmal“ insgesamt, meiste zuerst. */
export function problemCards(logs: readonly ReviewLogRecord[]): Array<{ cardId: string; again: number }> {
  return [...againCounts(logs)]
    .filter(([, n]) => isProblemCard(n))
    .map(([cardId, again]) => ({ cardId, again }))
    .sort((a, b) => b.again - a.again || a.cardId.localeCompare(b.cardId));
}

/**
 * Schwache Wörter: mindestens 3 „Nochmal“ in den letzten 30 Tagen (beide Richtungen zusammen),
 * meiste zuerst.
 */
export function weakWordIds(logs: readonly ReviewLogRecord[], now: Date): string[] {
  const perWord = new Map<string, number>();
  for (const [cardId, n] of againCounts(logs, now.getTime() - WEAK_WORD_WINDOW_DAYS * DAY_MS)) {
    const w = wordIdOfCard(cardId);
    perWord.set(w, (perWord.get(w) ?? 0) + n);
  }
  return [...perWord]
    .filter(([, n]) => n >= WEAK_WORD_AGAIN_MIN)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([w]) => w);
}
