/**
 * Universal date parsing utility for bulk imports and CRM record hydration.
 * Handles Excel serial day offsets, DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY,
 * textual dates (e.g. "14 Nov 2026"), and sanitizes empty/placeholder strings.
 */
export function parseFlexibleDate(val: any): string | null {
  if (val === null || val === undefined) return null;

  // Handle native Date object (e.g. from SheetJS with cellDates: true)
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
    }
    return null;
  }

  // Handle Excel numeric serial code (days since Dec 30, 1899)
  if (typeof val === 'number') {
    if (val > 10000 && val < 90000) {
      try {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          const pad = (n: number) => (n < 10 ? '0' + n : String(n));
          return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
        }
      } catch {}
    }
    return null;
  }

  let s = String(val).trim();

  // Strip formula-injection sanitization prefix if present (e.g., "'2026-10-20" or "'-")
  if (s.startsWith("'")) {
    s = s.slice(1).trim();
  }

  // Common empty / placeholder values
  if (!s || s === '-' || s === '—' || s === 'N/A' || s === 'n/a' || s === 'nil' || s === 'null' || s === '0' || s === 'undefined') {
    return null;
  }

  // Check if string is purely numeric (Excel serial as string like "45585")
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    if (num > 10000 && num < 90000) {
      try {
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          const pad = (n: number) => (n < 10 ? '0' + n : String(n));
          return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
        }
      } catch {}
    }
  }

  // Format 1: DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[\sT].*)?$/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    let day = part1;
    let month = part2;
    if (part2 > 12 && part1 <= 12) {
      // Swapped format: MM/DD/YYYY
      day = part2;
      month = part1;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => (n < 10 ? '0' + n : String(n));
        return `${year}-${pad(month)}-${pad(day)}`;
      }
    }
  }

  // Format 2: YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[\sT].*)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // Format 3: Parse standard ISO or textual string (e.g. "14 Nov 2026", "2026-11-14T00:00:00.000Z")
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    }
  } catch {}

  return null;
}

/**
 * Returns a guaranteed valid JavaScript Date object, or null.
 * Preserves exact time for ISO / datetime-local strings.
 * Never returns an Invalid Date (which crashes Prisma client validation).
 */
export function parseSafeDateObject(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  // Try direct date parsing first to preserve exact time
  try {
    const direct = new Date(val);
    if (!isNaN(direct.getTime())) {
      return direct;
    }
  } catch {}

  const isoStr = parseFlexibleDate(val);
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Converts any ISO string, Date object, or date string into local HTML5 datetime-local format:
 * "YYYY-MM-DDTHH:mm"
 * Preserves the user's LOCAL timezone time so that selected time does NOT shift.
 */
export function toDatetimeLocalValue(val?: string | Date | null): string {
  if (!val || val === '-' || val === '—' || val === 'N/A' || val === 'null' || val === 'undefined') return '';

  // If already in local YYYY-MM-DDTHH:mm format without trailing timezone offset/Z
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val.trim())) {
    return val.trim();
  }

  // If date-only "YYYY-MM-DD"
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return `${val.trim()}T10:00`;
  }

  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) {
      const flex = parseFlexibleDate(val);
      return flex ? `${flex}T10:00` : '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/** Backward compatibility alias for toDatetimeLocalValue */
export const formatForDatetimeLocal = toDatetimeLocalValue;

/**
 * Converts a local datetime-local string ("YYYY-MM-DDTHH:mm") into a standardized ISO 8601 UTC string
 * ("YYYY-MM-DDTHH:mm:00.000Z") for safe transmission to the database/server.
 */
export function toIsoFromDatetimeLocal(localStr?: string | null): string | null {
  if (!localStr || !localStr.trim()) return null;
  const s = localStr.trim();
  try {
    if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) {
      const fallback = new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10)
      );
      return isNaN(fallback.getTime()) ? null : fallback.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns current date and time formatted in user's local timezone for input min attribute:
 * "YYYY-MM-DDTHH:mm"
 */
export function getMinDatetimeLocal(): string {
  return toDatetimeLocalValue(new Date());
}

/**
 * Returns today's date in local YYYY-MM-DD format for <input type="date" min="..." />
 */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface TimeSlotOption {
  value: string; // "14:30"
  label: string; // "02:30 PM"
}

/**
 * Precomputed 15-minute time slots for business hours (08:00 AM to 09:00 PM).
 * Prevents any browser autoselection bugs.
 */
export const BUSINESS_TIME_SLOTS: TimeSlotOption[] = (() => {
  const slots: TimeSlotOption[] = [];
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const val = `${hh}:${mm}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const label = `${String(displayH).padStart(2, '0')}:${mm} ${period}`;
      slots.push({ value: val, label });
    }
  }
  return slots;
})();

/**
 * Splits an ISO / local date-time into separate local Date (YYYY-MM-DD) and Time (HH:mm) strings.
 */
export function splitDatetime(val?: string | Date | null): { date: string; time: string } {
  const localStr = toDatetimeLocalValue(val);
  if (!localStr) {
    return { date: '', time: '11:00' };
  }
  if (localStr.includes('T')) {
    const [d, t] = localStr.split('T');
    return { date: d || '', time: t ? t.slice(0, 5) : '11:00' };
  }
  return { date: localStr, time: '11:00' };
}

/**
 * Combines separate local date (YYYY-MM-DD) and time (HH:mm) into a single local ISO string.
 */
export function combineDateAndTime(dateStr?: string | null, timeStr?: string | null): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const t = timeStr && timeStr.trim() ? timeStr.trim().slice(0, 5) : '11:00';
  return toIsoFromDatetimeLocal(`${dateStr.trim()}T${t}`);
}

/* ------------------------------------------------------------------ *
 * Local-calendar helpers.
 * NEVER use `date.toISOString().split('T')[0]` for "today": that is the
 * UTC date, which is still yesterday in India until 05:30 AM, and turns
 * "1st of this month 00:00 IST" into the last day of the previous month.
 * ------------------------------------------------------------------ */

/** YYYY-MM-DD of an instant in the browser's local calendar. */
export function localDateKey(val: Date | string | number = new Date()): string {
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Adds whole days to a YYYY-MM-DD key (local calendar). */
export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map((p) => parseInt(p, 10));
  return localDateKey(new Date(y, m - 1, d + days));
}

/** Local midnight (start) / 23:59:59.999 (end) of a YYYY-MM-DD key, as epoch ms. */
export function dateKeyBounds(key: string): { startMs: number; endMs: number } {
  const [y, m, d] = key.split('-').map((p) => parseInt(p, 10));
  return {
    startMs: new Date(y, m - 1, d, 0, 0, 0, 0).getTime(),
    endMs: new Date(y, m - 1, d, 23, 59, 59, 999).getTime(),
  };
}

/** Earliest 15-minute business slot that is still in the future (with a small buffer). */
export function getNextAvailableSlot(bufferMinutes = 15): { date: string; time: string } {
  const now = new Date(Date.now() + bufferMinutes * 60000);
  const today = localDateKey(now);
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const slot = BUSINESS_TIME_SLOTS.find((s) => s.value >= nowHHmm);
  if (slot && localDateKey(now) === localDateKey(new Date())) return { date: today, time: slot.value };
  return { date: addDaysToDateKey(localDateKey(new Date()), 1), time: '11:00' };
}

/** True when the combined local date + time is already in the past. */
export function isPastLocalDateTime(dateStr: string, timeStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map((p) => parseInt(p, 10));
  const [hh, mm] = (timeStr || '00:00').split(':').map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime() < Date.now() - 60000;
}

/** Formats "HH:mm" as "hh:mm AM/PM". */
export function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((p) => parseInt(p, 10));
  if (isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
}
