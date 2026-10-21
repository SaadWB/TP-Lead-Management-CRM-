export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: unknown[];

  constructor(message: string, statusCode = 500, errors?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors?: unknown[]) {
    super(message, 400, errors);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: unknown[]) {
    super(message, 422, errors);
  }
}
