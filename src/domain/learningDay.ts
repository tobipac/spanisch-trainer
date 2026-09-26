// Lerntag: wechselt um 04:00 Uhr lokaler Zeit (nicht um Mitternacht).
import { DAY_START_HOUR } from '../config/learning.ts';

const pad = (n: number) => String(n).padStart(2, '0');

function formatKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseKey(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Ungültiger Lerntag: ${day}`);
  return [y, m, d];
}

/** Lerntag (YYYY-MM-DD) für einen Zeitpunkt. 03:59 gehört noch zum Vortag. */
export function learningDayOf(time: Date | number): string {
  const t = new Date(time);
  // Kalenderdatum als lokales Mittag, damit Sommerzeitumstellungen nicht stören.
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12);
  if (t.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return formatKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Beginn des Lerntags (04:00 lokal). */
export function dayStart(day: string): Date {
  const [y, m, d] = parseKey(day);
  return new Date(y, m - 1, d, DAY_START_HOUR);
}

/** Lerntag um n Tage verschoben. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = parseKey(day);
  const date = new Date(y, m - 1, d + n, 12);
  return formatKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Ende des Lerntags = Beginn des nächsten (exklusiv). */
export function dayEnd(day: string): Date {
  return dayStart(addDays(day, 1));
}

/** Anzahl Lerntage von a bis b (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parseKey(a);
  const [by, bm, bd] = parseKey(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Montag der Kalenderwoche (Mo–So) eines Lerntags. Die Woche beginnt also Montag 04:00. */
export function weekOf(day: string): string {
  const [y, m, d] = parseKey(day);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = So
  return addDays(day, -((weekday + 6) % 7));
}
