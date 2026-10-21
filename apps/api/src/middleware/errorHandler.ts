import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation error', 422, formattedErrors);
    return;
  }

  // App specific operational errors
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Unexpected errors
  console.error('[UNHANDLED ERROR]', err);
  sendError(
    res,
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : err.message,
    500
  );
}
