import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupFileName, exportBackup, importBackup, parseBackup } from '../src/db/backup.ts';
import { DEFAULT_SETTINGS, getOrCreateDay, rate, saveSettings } from '../src/db/repository.ts';
import { TrainerDB } from '../src/db/schema.ts';
import { newSession, nextCard } from '../src/domain/session.ts';
import { at, words } from './helpers.ts';

const W = words(20);
let n = 0;
let source: TrainerDB;
let target: TrainerDB;

beforeEach(async () => {
  source = new TrainerDB(`backup-src-${n}`);
  target = new TrainerDB(`backup-dst-${n++}`);
  await Promise.all([source.open(), target.open()]);
});
afterEach(async () => {
  await Promise.all([source.delete(), target.delete()]);
});

/** Ein paar echte Bewertungen erzeugen, damit Karten, Logs und Tage mit Datumswerten existieren. */
async function learnSomething(db: TrainerDB) {
  await saveSettings(db, { ...DEFAULT_SETTINGS, newPerDay: 8, lastBackupAt: 123, onboardingDone: true });
  let now = at(2026, 10, 5, 10);
  for (let i = 0; i < 12; i++) {
    const day = await getOrCreateDay(db, now, W);
    const next = nextCard({ now, day, cards: await db.cards.toArray(), words: W, settings: { ...DEFAULT_SETTINGS, newPerDay: 8 }, session: newSession() });
    if (!next) break;
    await rate(db, { now, next, rating: 3, words: W, session: newSession() });
    now = new Date(now.getTime() + 11 * 60_000);
  }
}

const snapshot = async (db: TrainerDB) => ({
  cards: (await db.cards.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
  logs: await db.reviewLogs.toArray(),
  days: await db.days.toArray(),
  settings: await db.settings.toArray(),
});

describe('Backup', () => {
  it('Dateiname YYMMDD Spanisch-Trainer_Backup.json', () => {
    expect(backupFileName(at(2026, 9, 24, 23, 30))).toBe('260924 Spanisch-Trainer_Backup.json');
  });

  it('Export → JSON → Import stellt den Stand exakt wieder her (inkl. Datumswerte)', async () => {
    await learnSomething(source);
    const before = await snapshot(source);
    expect(before.cards.length).toBeGreaterThan(0);
    expect(before.logs.length).toBeGreaterThan(0);

    const json = JSON.stringify(await exportBackup(source, at(2026, 10, 5, 12)));
    const { backup, summary } = parseBackup(json);
    expect(summary).toMatchObject({ cards: before.cards.length, reviewLogs: before.logs.length, days: 1 });
    expect(summary.exportedAt).toEqual(at(2026, 10, 5, 12));

    await importBackup(target, backup);
    const after = await snapshot(target);
    expect(after).toEqual(before);
    expect(after.cards[0]!.fsrs.due).toBeInstanceOf(Date);
    expect(after.logs[0]!.log.review).toBeInstanceOf(Date);
  });

  it('Import ersetzt vorhandene Daten vollständig', async () => {
    await learnSomething(target); // „altes“ Gerät mit anderem Stand
    const empty = parseBackup(JSON.stringify(await exportBackup(source, at(2026, 10, 6)))).backup;
    await importBackup(target, empty);
    expect(await target.cards.count()).toBe(0);
    expect(await target.reviewLogs.count()).toBe(0);
    expect(await target.settings.count()).toBe(0);
  });

  it('lehnt ungültige Dateien mit verständlicher Meldung ab', () => {
    expect(() => parseBackup('kein json')).toThrow('kein gültiges JSON');
    expect(() => parseBackup('{"format":"anderes"}')).toThrow('kein Backup');
    expect(() => parseBackup('{"format":"spanisch-trainer-backup","schemaVersion":99,"data":{}}')).toThrow('neueren App-Version');
    expect(() => parseBackup('{"format":"spanisch-trainer-backup","schemaVersion":1,"data":{"cards":[]}}')).toThrow('unvollständig');
    const badDate = '{"format":"spanisch-trainer-backup","schemaVersion":1,"exportedAt":"2026-10-05T10:00:00Z","data":{"cards":[{"id":"w0001:es-de","wordId":"w0001","fsrs":{"due":"kaputt"}}],"reviewLogs":[],"days":[]}}';
    expect(() => parseBackup(badDate)).toThrow('Datumswerte');
  });

  it('ein fehlgeschlagener Import lässt die vorhandenen Daten unverändert', async () => {
    await learnSomething(target);
    const before = await snapshot(target);
    const { backup } = parseBackup(JSON.stringify(await exportBackup(target, at(2026, 10, 6))));
    const broken = { ...backup, data: { ...backup.data, days: [...backup.data.days, backup.data.days[0]!] } }; // doppelter Schlüssel
    await expect(importBackup(target, broken)).rejects.toThrow();
    expect(await snapshot(target)).toEqual(before);
  });
});
