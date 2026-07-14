import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../http/errors.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let apiError: ApiError;
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    apiError = new ApiError(
      422,
      'VALIDATION_ERROR',
      'Please correct the highlighted fields.',
      Object.fromEntries(error.issues.map((issue) => [issue.path.join('.'), issue.message])),
    );
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    apiError = new ApiError(409, 'CONFLICT', 'The requested change conflicts with existing data.');
  } else if (error instanceof SyntaxError && 'body' in error) {
    apiError = new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  } else if (error instanceof Error && error.name === 'PasswordHashBusyError') {
    apiError = new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  } else if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    apiError = new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  } else {
    apiError = new ApiError(500, 'INTERNAL_ERROR', 'The request could not be completed.');
    console.error(JSON.stringify({ level: 'error', requestId: req.requestId, code: 'UNHANDLED_ERROR', message: error instanceof Error ? error.message : 'unknown' }));
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId: req.requestId,
      ...(apiError.fieldErrors ? { fieldErrors: apiError.fieldErrors } : {}),
      ...(env.NODE_ENV === 'development' && apiError.status >= 500 ? { development: 'See server log using requestId.' } : {}),
    },
  });
};
