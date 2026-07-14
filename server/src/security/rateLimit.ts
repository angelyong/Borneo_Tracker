import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { ApiError } from '../http/errors.js';
import { fingerprint } from './crypto.js';

type Bucket = { count: number; expires_at: Date };

export const enforceRateLimit = async (
  req: Request,
  res: Response,
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
) => {
  const keys = [
    `${scope}:ip:${fingerprint(req.ip ?? 'unknown')}`,
    `${scope}:subject:${fingerprint(subject)}`,
  ];
  for (const key of keys) {
  const rows = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    INSERT INTO rate_limit_buckets (key, count, window_start, expires_at)
    VALUES (${key}, 1, NOW(), NOW() + (${windowSeconds} * INTERVAL '1 second'))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_buckets.expires_at <= NOW() THEN 1 ELSE rate_limit_buckets.count + 1 END,
      window_start = CASE WHEN rate_limit_buckets.expires_at <= NOW() THEN NOW() ELSE rate_limit_buckets.window_start END,
      expires_at = CASE WHEN rate_limit_buckets.expires_at <= NOW() THEN NOW() + (${windowSeconds} * INTERVAL '1 second') ELSE rate_limit_buckets.expires_at END
    RETURNING count, expires_at
  `);
  const bucket = rows[0];
  if (bucket && bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.expires_at.getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  }
  }
};
