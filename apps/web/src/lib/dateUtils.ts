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
