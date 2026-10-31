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
  // 1. Zod input validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation error', 422, formattedErrors);
    return;
  }

  // 2. Controlled operational application errors
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // 3. Database / Prisma driver errors
  if (err.name === 'PrismaClientKnownRequestError' || err.name === 'PrismaClientValidationError') {
    console.error('[DATABASE ERROR]', err);
    sendError(
      res,
      process.env.NODE_ENV === 'production'
        ? 'A database error occurred. Please try again later.'
        : `Database Error: ${err.message}`,
      500
    );
    return;
  }

  // 4. Unexpected server exceptions
  console.error('[UNHANDLED SERVER ERROR]', err);
  sendError(
    res,
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : err.message,
    500
  );
}
