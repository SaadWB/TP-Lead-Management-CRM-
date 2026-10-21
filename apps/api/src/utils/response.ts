import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
  errors?: unknown[];
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: ApiResponse['meta']
): void {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };
  res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown[]
): void {
  const payload: ApiResponse = {
    success: false,
    message,
    ...(errors && { errors }),
  };
  res.status(statusCode).json(payload);
}
