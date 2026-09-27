import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrainerDB } from '../src/db/schema.ts';
import { DEFAULT_SETTINGS, getOrCreateDay, loadSettings, rate, saveSettings, undo } from '../src/db/repository.ts';
import { newSession, nextCard } from '../src/domain/session.ts';
import { at, queuedReverse, reviewCard, words } from './helpers.ts';

const NOW = at(2026, 10, 1, 10);
const W = words(5);
let db: TrainerDB;
let n = 0;

beforeEach(async () => {
  db = new TrainerDB(`test-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

async function next(now = NOW) {
  const day = await getOrCreateDay(db, now, W);
  const card = nextCard({
    now,
    day,
    cards: await db.cards.toArray(),
    words: W,
    settings: await loadSettings(db),
    session: newSession(),
  });
  if (!card) throw new Error('keine Karte');
  return card;
}

const snapshot = async () => ({
  cards: (await db.cards.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
  logs: await db.reviewLogs.toArray(),
  days: await db.days.toArray(),
});

describe('Einstellungen', () => {
  it('liefert Standardwerte ohne gespeicherten Datensatz', async () => {
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('speichert und lädt', async () => {
    await saveSettings(db, { ...DEFAULT_SETTINGS, newPerDay: 8 });
    expect((await loadSettings(db)).newPerDay).toBe(8);
    expect(await db.settings.count()).toBe(1);
  });
});

describe('Tagesdatensatz', () => {
  it('wird einmal pro Lerntag angelegt, der Snapshot bleibt stabil', async () => {
    await db.cards.add(reviewCard('a', at(2026, 10, 1, 8)));
    const first = await getOrCreateDay(db, NOW, W);
    expect(first.dueAtStartIds).toEqual(['a:es-de']);
    await db.cards.add(reviewCard('b', at(2026, 10, 1, 8)));
    const again = await getOrCreateDay(db, at(2026, 10, 1, 20), W);
    expect(again.dueAtStartIds).toEqual(['a:es-de']);
    // 03:59 am Folgetag gehört noch zum selben Lerntag, 04:00 nicht mehr
    expect((await getOrCreateDay(db, at(2026, 10, 2, 3, 59), W)).day).toBe('2026-10-01');
    expect((await getOrCreateDay(db, at(2026, 10, 2, 4, 0), W)).day).toBe('2026-10-02');
    expect(await db.days.count()).toBe(2);
  });

  it('gleichzeitige Aufrufe legen den Tag nur einmal an und scheitern nicht', async () => {
    await db.cards.add(reviewCard('a', at(2026, 10, 1, 8)));
    const results = await Promise.all(Array.from({ length: 5 }, () => getOrCreateDay(db, NOW, W)));
    expect(new Set(results.map((r) => r.day))).toEqual(new Set(['2026-10-01']));
    expect(await db.days.count()).toBe(1);
  });
});

describe('Bewerten', () => {
  it('speichert Karte, Log und Tageszähler in einer Transaktion', async () => {
    const card = await next();
    const { result } = await rate(db, { now: NOW, next: card, rating: 3, words: W, session: newSession() });
    expect(await db.cards.get(result.card.id)).toEqual(result.card);
    expect(await db.reviewLogs.count()).toBe(1);
    expect((await db.days.get('2026-10-01'))?.newDone).toBe(1);
  });

  it('reiht eine Umkehrkarte in der Datenbank ein', async () => {
    await db.cards.add(reviewCard('w0001', at(2026, 10, 1, 8)));
    const { result } = await rate(db, { now: NOW, next: await next(), rating: 3, words: W, session: newSession() });
    expect(result.createdReverse).not.toBeNull();
    expect(await db.cards.get('w0001:de-es')).toMatchObject({ introducedAt: null, queuedAt: NOW.getTime() });
  });

  it('bricht ohne Tagesdatensatz ab und schreibt nichts', async () => {
    const card = await next();
    await db.days.clear();
    await expect(rate(db, { now: NOW, next: card, rating: 3, words: W, session: newSession() })).rejects.toThrow();
    expect(await db.cards.count()).toBe(0);
    expect(await db.reviewLogs.count()).toBe(0);
  });
});

describe('Rückgängig', () => {
  it('stellt nach einer Wiederholung mit Umkehrkarte den exakten Stand wieder her', async () => {
    await db.cards.bulkAdd([reviewCard('w0001', at(2026, 10, 1, 8)), queuedReverse('w0002', at(2026, 9, 30, 10))]);
    const card = await next();
    const before = await snapshot();
    const session = { reviewsSinceNew: 2 };
    const { result, undo: token } = await rate(db, { now: NOW, next: card, rating: 3, words: W, session });
    expect(result.createdReverse).not.toBeNull();
    expect(await undo(db, token)).toEqual(session);
    expect(await snapshot()).toEqual(before);
  });

  it('entfernt ein neu eingeführtes Wort wieder vollständig', async () => {
    const card = await next();
    expect(card.kind).toBe('new');
    const before = await snapshot();
    const { undo: token } = await rate(db, { now: NOW, next: card, rating: 3, words: W, session: newSession() });
    await undo(db, token);
    expect(await snapshot()).toEqual(before);
    expect(await db.cards.count()).toBe(0);
  });

  it('nimmt nur die letzte Bewertung zurück, frühere bleiben erhalten', async () => {
    const first = await rate(db, { now: NOW, next: await next(), rating: 3, words: W, session: newSession() });
    const later = new Date(NOW.getTime() + 10_000);
    const second = await rate(db, { now: later, next: await next(later), rating: 3, words: W, session: newSession() });
    await undo(db, second.undo);
    expect(await db.reviewLogs.count()).toBe(1);
    expect(await db.cards.get(first.result.card.id)).toEqual(first.result.card);
    expect((await db.days.get('2026-10-01'))?.newDone).toBe(1);
  });
});

describe('Schema', () => {
  it('Version 1 mit den erwarteten Tabellen', () => {
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['cards', 'days', 'reviewLogs', 'settings']);
  });

  it('Daten überleben Schließen und erneutes Öffnen', async () => {
    await db.cards.add(reviewCard('a', NOW));
    const name = db.name;
    db.close();
    const reopened = new TrainerDB(name);
    expect(await reopened.cards.count()).toBe(1);
    reopened.close();
    await db.open();
  });
});
