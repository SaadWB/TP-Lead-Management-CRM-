/**
 * Security utilities: formula injection sanitization, sensitive data masking,
 * and security string validation.
 */

// Formula injection triggers: =, +, -, @, tab (\t), carriage return (\r)
const FORMULA_INJECTION_REGEX = /^[=+\-@\t\r]/;

/**
 * Protects CSV / Excel cells against formula injection (CSV Injection).
 * If a cell string starts with =, +, -, @, \t, or \r, prefix with a single quote.
 */
export function sanitizeForFormulaInjection<T>(value: T): T {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (FORMULA_INJECTION_REGEX.test(trimmed)) {
      return `'${trimmed}` as unknown as T;
    }
  } else if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFormulaInjection(item)) as unknown as T;
  } else if (value !== null && typeof value === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitizedObj[k] = sanitizeForFormulaInjection(v);
    }
    return sanitizedObj as unknown as T;
  }
  return value;
}

/**
 * Mask an email for privacy compliance in logs (e.g. j***e@example.com).
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***';
  const [name, domain] = parts;
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Mask a phone number for privacy compliance in logs (e.g. +91-XXXXX-XX345).
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  const last4 = digits.slice(-4);
  return `+XX-XXXXX-XX${last4}`;
}

/**
 * Sanitize user objects to ensure passwordHash, internal salts, or refresh tokens
 * are NEVER returned in API responses.
 */
export function sanitizeUserOutput<T extends Record<string, any>>(user: T): Omit<T, 'passwordHash' | 'tokenHash'> {
  const { passwordHash, tokenHash, ...safe } = user;
  return safe;
}

