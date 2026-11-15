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
 * Converts any date or ISO string into the format required by HTML5 <input type="datetime-local" />
 * Format: YYYY-MM-DDTHH:mm
 */
export function formatForDatetimeLocal(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr === '—' || dateStr === 'N/A' || dateStr === 'null') return '';
  const clean = parseFlexibleDate(dateStr);
  if (!clean) return '';
  if (typeof dateStr === 'string' && dateStr.includes('T') && dateStr.length >= 16) {
    return dateStr.slice(0, 16);
  }
  return `${clean}T09:00`;
}
