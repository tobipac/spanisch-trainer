// Dexie-Schema. Änderungen nur über neue, versionierte Migrationen (this.version(n+1)…),
// bestehende Versionen nie umschreiben – am Gerät hängt Lernfortschritt daran.
import Dexie, { type Table } from 'dexie';
import type { CardRecord, DayRecord, PracticeResult, ReviewLogRecord, Settings } from '../domain/types.ts';

export type SettingsRow = Settings & { id: 'settings' };

export const DB_NAME = 'spanisch-trainer';

export class TrainerDB extends Dexie {
  cards!: Table<CardRecord, string>;
  reviewLogs!: Table<ReviewLogRecord, number>;
  days!: Table<DayRecord, string>;
  settings!: Table<SettingsRow, string>;
  practiceResults!: Table<PracticeResult, number>;

  constructor(name = DB_NAME) {
    super(name);
    // Version 1 (E1): Ausgangsschema.
    this.version(1).stores({
      cards: 'id, wordId, direction, introducedAt, queuedAt',
      reviewLogs: '++id, cardId, reviewedAt',
      days: 'day',
      settings: 'id',
    });
    // Version 2: Ergebnisse der Extra-Übung „Schwache Wörter“ (neue Tabelle, bestehende Daten unverändert).
    this.version(2).stores({
      practiceResults: '++id, day, finishedAt',
    });
  }
}
