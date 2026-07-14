import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../http/errors.js';

export const corsAndOrigin = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.header('origin');
  if (origin && env.ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Request-ID');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.append('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    if (!origin || !env.ALLOWED_ORIGINS.has(origin)) return next(new ApiError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.'));
    return res.sendStatus(204);
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (!origin || !env.ALLOWED_ORIGINS.has(origin)) return next(new ApiError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.'));
    if (!req.is('application/json')) return next(new ApiError(415, 'JSON_REQUIRED', 'Content-Type must be application/json.'));
  }
  next();
};
