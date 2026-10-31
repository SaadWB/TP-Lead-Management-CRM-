import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private hits = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private message: string;

  constructor(windowMs: number, maxRequests: number, message: string) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;

    // Periodic cleanup of stale IP records every 5 minutes
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.hits.entries()) {
        if (now > record.resetTime) {
          this.hits.delete(key);
        }
      }
    }, 5 * 60 * 1000);
    if (cleanup.unref) cleanup.unref();
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // In automated testing environments, bypass rate limiting
      if (process.env.NODE_ENV === 'test') {
        return next();
      }

      const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
      const now = Date.now();
      let record = this.hits.get(ip);

      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + this.windowMs };
        this.hits.set(ip, record);
      } else {
        record.count++;
      }

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      if (record.count > this.maxRequests) {
        return next(new TooManyRequestsError(this.message));
      }

      next();
    };
  }

  public reset(ip: string) {
    this.hits.delete(ip);
  }
}

// 1. Strict Login Brute-Force Limiter: 5 attempts per 15 minutes per IP
export const authRateLimiter = new InMemoryRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many login attempts from this IP address. Please wait 15 minutes before trying again.'
);

// 2. Sensitive Endpoints Limiter: 10 requests per 15 minutes
export const sensitiveRateLimiter = new InMemoryRateLimiter(
  15 * 60 * 1000,
  10,
  'Rate limit exceeded for sensitive requests. Please wait before retrying.'
);

// 3. General API Rate Limiter: 300 requests per 15 minutes
export const apiRateLimiter = new InMemoryRateLimiter(
  15 * 60 * 1000,
  300,
  'Too many requests to the API. Please slow down.'
);

