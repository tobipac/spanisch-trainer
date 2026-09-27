// Schreibt die Ergebnisse der Lernlogik atomar in IndexedDB. Keine eigene Lernlogik hier.
import { DEFAULT_SPEECH_RATE, NEW_PER_DAY_DEFAULT } from '../config/learning.ts';
import { learningDayOf } from '../domain/learningDay.ts';
import {
  applyRating,
  createDayRecord,
  type NextCard,
  type RatingResult,
  type SessionState,
  type UndoEntry,
} from '../domain/session.ts';
import type { DayRecord, Rating, Settings, WordRef } from '../domain/types.ts';
import type { SettingsRow, TrainerDB } from './schema.ts';

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: NEW_PER_DAY_DEFAULT,
  autoPlayAudio: true,
  speechRate: DEFAULT_SPEECH_RATE,
  onboardingDone: false,
};

export async function loadSettings(db: TrainerDB): Promise<Settings> {
  const row = await db.settings.get('settings');
  if (!row) return { ...DEFAULT_SETTINGS };
  const { id: _id, ...settings } = row;
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(db: TrainerDB, settings: Settings): Promise<void> {
  const row: SettingsRow = { ...settings, id: 'settings' };
  await db.settings.put(row);
}

/** Tagesdatensatz des aktuellen Lerntags holen oder beim ersten Öffnen anlegen (Snapshot der fälligen Karten). */
export async function getOrCreateDay(db: TrainerDB, now: Date, words: WordRef[]): Promise<DayRecord> {
  const day = learningDayOf(now);
  try {
    return await db.transaction('rw', db.days, db.cards, db.settings, async () => {
      const existing = await db.days.get(day);
      if (existing) return existing;
      const record = createDayRecord(day, await db.cards.toArray(), words, await loadSettings(db));
      await db.days.add(record);
      return record;
    });
  } catch (e) {
    // Zwei gleichzeitige Aufrufe (z. B. Heute-Screen und Rückkehr in die App nach 04:00):
    // der zweite scheitert am bereits angelegten Datensatz – dann diesen verwenden.
    const existing = await db.days.get(day);
    if (existing) return existing;
    throw e;
  }
}

/** Rückgängig-Information inklusive der von IndexedDB vergebenen Log-ID. */
export interface UndoToken {
  entry: UndoEntry;
  logId: number;
}

export async function rate(
  db: TrainerDB,
  args: { now: Date; next: NextCard; rating: Rating; words: WordRef[]; session: SessionState },
): Promise<{ result: RatingResult; undo: UndoToken }> {
  return db.transaction('rw', [db.cards, db.reviewLogs, db.days, db.settings], async () => {
    const day = await db.days.get(learningDayOf(args.now));
    if (!day) throw new Error('Tagesdatensatz fehlt – zuerst getOrCreateDay aufrufen.');
    const result = applyRating({
      ...args,
      day,
      cards: await db.cards.toArray(),
      settings: await loadSettings(db),
    });
    await db.cards.put(result.card);
    if (result.createdReverse) await db.cards.add(result.createdReverse);
    await db.days.put(result.day);
    const logId = await db.reviewLogs.add(result.log);
    return { result, undo: { entry: result.undo, logId } };
  });
}

/** Letzte Bewertung zurücknehmen: Karte, Log, Tageszähler und ggf. eingereihte Umkehrkarte. */
export async function undo(db: TrainerDB, token: UndoToken): Promise<SessionState> {
  const { entry, logId } = token;
  await db.transaction('rw', [db.cards, db.reviewLogs, db.days], async () => {
    if (entry.previousCard) await db.cards.put(entry.previousCard);
    else await db.cards.delete(entry.cardId);
    if (entry.createdReverseId) {
      const reverse = await db.cards.get(entry.createdReverseId);
      if (reverse && reverse.introducedAt === null) await db.cards.delete(entry.createdReverseId);
    }
    await db.reviewLogs.delete(logId);
    await db.days.put(entry.previousDay);
  });
  return entry.previousSession;
}
