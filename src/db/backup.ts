// Backup: Export und Import aller Lerndaten als eine JSON-Datei (SPEC.md Abschnitt 9).
import type { CardRecord, DayRecord, ReviewLogRecord, Settings } from '../domain/types.ts';
import type { SettingsRow, TrainerDB } from './schema.ts';

export const BACKUP_FORMAT = 'spanisch-trainer-backup';
/** Version des Backup-Formats. Bei Änderungen erhöhen und in parseBackup migrieren. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  dbVersion: number;
  exportedAt: string;
  data: {
    cards: CardRecord[];
    reviewLogs: ReviewLogRecord[];
    days: DayRecord[];
    settings: Settings | null;
  };
}

export interface BackupSummary {
  exportedAt: Date;
  cards: number;
  wordsIntroduced: number;
  reviewLogs: number;
  days: number;
}

export async function exportBackup(db: TrainerDB, now: Date): Promise<BackupFile> {
  return db.transaction('r', [db.cards, db.reviewLogs, db.days, db.settings], async () => {
    const settingsRow = await db.settings.get('settings');
    let settings: Settings | null = null;
    if (settingsRow) {
      const { id: _id, ...rest } = settingsRow;
      settings = rest;
    }
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      dbVersion: db.verno,
      exportedAt: now.toISOString(),
      data: {
        cards: await db.cards.toArray(),
        reviewLogs: await db.reviewLogs.toArray(),
        days: await db.days.toArray(),
        settings,
      },
    };
  });
}

/** Dateiname laut SPEC: `YYMMDD Spanisch-Trainer_Backup.json` (lokales Datum). */
export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(now.getFullYear() % 100)}${p(now.getMonth() + 1)}${p(now.getDate())} Spanisch-Trainer_Backup.json`;
}

const toDate = (v: unknown): Date => {
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) throw new Error('ungültiges Datum');
  return d;
};

type Revivable = Record<string, unknown>;

/** Nach JSON.parse sind Datumswerte Texte – für ts-fsrs wieder echte Date-Objekte herstellen. */
function reviveCard(c: CardRecord): CardRecord {
  const f = c.fsrs as unknown as Revivable;
  return {
    ...c,
    fsrs: {
      ...c.fsrs,
      due: toDate(f.due),
      ...(f.last_review != null ? { last_review: toDate(f.last_review) } : {}),
    },
  };
}

function reviveLog(l: ReviewLogRecord): ReviewLogRecord {
  const g = l.log as unknown as Revivable;
  return { ...l, log: { ...l.log, due: toDate(g.due), review: toDate(g.review) } };
}

/**
 * Prüft eine eingelesene Datei und stellt Datumswerte wieder her.
 * Wirft einen Fehler mit verständlicher Meldung, wenn die Datei kein gültiges Backup ist.
 */
export function parseBackup(text: string): { backup: BackupFile; summary: BackupSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const b = raw as Partial<BackupFile>;
  if (!b || b.format !== BACKUP_FORMAT) throw new Error('Die Datei ist kein Backup dieses Vokabeltrainers.');
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  }
  const d = b.data;
  if (!d || !Array.isArray(d.cards) || !Array.isArray(d.reviewLogs) || !Array.isArray(d.days)) {
    throw new Error('Das Backup ist unvollständig.');
  }
  for (const c of d.cards) {
    if (typeof c?.id !== 'string' || typeof c.wordId !== 'string' || !c.fsrs) throw new Error('Das Backup enthält ungültige Karten.');
  }
  for (const day of d.days) {
    if (typeof day?.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day)) throw new Error('Das Backup enthält ungültige Tage.');
  }

  let backup: BackupFile;
  try {
    backup = {
      format: BACKUP_FORMAT,
      schemaVersion: b.schemaVersion,
      dbVersion: b.dbVersion ?? 1,
      exportedAt: String(b.exportedAt),
      data: {
        cards: d.cards.map(reviveCard),
        reviewLogs: d.reviewLogs.map(reviveLog),
        days: d.days,
        settings: d.settings ?? null,
      },
    };
  } catch {
    throw new Error('Das Backup enthält ungültige Datumswerte.');
  }

  return {
    backup,
    summary: {
      exportedAt: toDate(backup.exportedAt),
      cards: backup.data.cards.length,
      wordsIntroduced: backup.data.cards.filter((c) => c.direction === 'es-de' && c.introducedAt !== null).length,
      reviewLogs: backup.data.reviewLogs.length,
      days: backup.data.days.length,
    },
  };
}

/** Ersetzt den gesamten Lernstand durch das Backup (eine Transaktion: alles oder nichts). */
export async function importBackup(db: TrainerDB, backup: BackupFile): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewLogs, db.days, db.settings], async () => {
    await Promise.all([db.cards.clear(), db.reviewLogs.clear(), db.days.clear(), db.settings.clear()]);
    await db.cards.bulkAdd(backup.data.cards);
    await db.reviewLogs.bulkAdd(backup.data.reviewLogs);
    await db.days.bulkAdd(backup.data.days);
    if (backup.data.settings) {
      const row: SettingsRow = { ...backup.data.settings, id: 'settings' };
      await db.settings.put(row);
    }
  });
}
