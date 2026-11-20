import { Request } from 'express';

/**
 * The CRM is used from India, but servers (Vercel) run in UTC.
 * Every "today / this morning / 10 AM" calculation must therefore use the
 * user's local offset, never the server clock's timezone.
 *
 * Offset convention: minutes EAST of UTC (IST = +330), i.e. -new Date().getTimezoneOffset().
 */
const DEFAULT_OFFSET_MINUTES = (() => {
  const raw = parseInt(process.env.APP_TZ_OFFSET_MINUTES || '', 10);
  return Number.isFinite(raw) ? raw : 330; // Asia/Kolkata
})();

function clampOffset(n: number): number {
  return Math.max(-720, Math.min(840, Math.round(n)));
}

/** Reads the browser offset sent by the frontend (query `tz` or header `x-tz-offset`). */
export function getTzOffsetMinutes(req: Request): number {
  const raw = (req.query?.tz as string | undefined) ?? (req.headers['x-tz-offset'] as string | undefined);
  if (raw !== undefined && raw !== '') {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n)) return clampOffset(n);
  }
  return DEFAULT_OFFSET_MINUTES;
}

/** "YYYY-MM-DD" of the given instant in the user's local calendar. */
export function localDateKey(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return shifted.toISOString().slice(0, 10);
}

/** "HH:mm" of the given instant in the user's local clock. */
export function localTimeHHmm(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return shifted.toISOString().slice(11, 16);
}

/** UTC instants covering the full local day `dateKey` (YYYY-MM-DD). */
export function localDayRange(dateKey: string, offsetMinutes: number): { start: Date; end: Date } {
  const [y, m, d] = dateKey.split('-').map((p) => parseInt(p, 10));
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMinutes * 60000;
  return { start: new Date(startUtcMs), end: new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1) };
}

/** Shifts a YYYY-MM-DD key by whole days. */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** UTC instant for a local wall-clock time, e.g. (2026-11-21, "10:00") in IST. */
export function localDateTimeToUtc(dateKey: string, hhmm: string, offsetMinutes: number): Date {
  const [y, m, d] = dateKey.split('-').map((p) => parseInt(p, 10));
  const [hh, mm] = hhmm.split(':').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0, 0) - offsetMinutes * 60000);
}

export function isValidDateKey(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
}
