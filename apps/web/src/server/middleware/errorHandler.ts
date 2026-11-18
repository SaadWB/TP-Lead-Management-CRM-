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
  if (err.name?.startsWith('PrismaClient') || (err as any).code?.startsWith('P')) {
    console.error('[DATABASE ERROR]', err);
    let userMsg = 'A temporary database error occurred. Please try again.';
    const pCode = (err as any).code;
    if (pCode === 'P2002') {
      const target = (err as any).meta?.target;
      userMsg = `Duplicate entry error: ${target ? `Field '${target}' already exists.` : 'A record with these details already exists.'}`;
    } else if (pCode === 'P2003') {
      userMsg = 'Database relation error: The referenced record or user was not found.';
    } else if (pCode === 'P2025') {
      userMsg = 'The requested database record was not found.';
    } else if (pCode === 'P1017' || pCode === 'P1001' || pCode === 'P1008' || pCode === 'P2024' || err.message?.includes('closed the connection')) {
      userMsg = 'Database connection was temporarily lost. Please try again.';
    } else if (pCode === 'P2000') {
      userMsg = 'The text provided is too long for one of the fields.';
    } else if (err.name === 'PrismaClientValidationError') {
      userMsg = 'Invalid data format provided for database operation.';
    } else if (err.message && process.env.NODE_ENV !== 'production') {
      userMsg = `Database Error: ${err.message}`;
    }
    sendError(res, userMsg, 500);
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
