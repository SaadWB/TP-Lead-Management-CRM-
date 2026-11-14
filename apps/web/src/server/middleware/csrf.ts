import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { config } from '../config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Validates Origin / Referer on all state-changing requests (POST, PUT, PATCH, DELETE)
 * to prevent Cross-Site Request Forgery (CSRF) when cookie authentication is active.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Safe read-only HTTP methods do not alter state
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Bypass in test environment
  if (config.nodeEnv === 'test') {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Expected trusted origins
  const allowedOrigins = [
    config.corsOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  if (origin) {
    const isAllowed = allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));
    if (!isAllowed) {
      return next(new ForbiddenError(`CSRF Blocked: Unauthorized request origin "${origin}"`));
    }
    return next();
  }

  if (referer) {
    const isAllowed = allowedOrigins.some((allowed) => referer.startsWith(allowed));
    if (!isAllowed) {
      return next(new ForbiddenError(`CSRF Blocked: Unauthorized request referer "${referer}"`));
    }
    return next();
  }

  // If neither Origin nor Referer is present, allow only if Authorization header is used (e.g. CLI or mobile client)
  if (req.headers.authorization) {
    return next();
  }

  // For state-changing requests with cookies, Origin or Referer is mandatory
  if (req.cookies && (req.cookies.token || req.cookies.refreshToken)) {
    return next(new ForbiddenError('CSRF Blocked: Missing Origin or Referer header on cookie-authenticated request'));
  }

  next();
}

