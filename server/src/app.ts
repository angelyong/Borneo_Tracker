import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { prisma } from './db/client.js';
import { ApiError } from './http/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { corsAndOrigin } from './middleware/origin.js';
import { requestId } from './middleware/requestId.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  if (env.isProduction) app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: env.isProduction ? undefined : false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  }));
  app.use(requestId);
  app.use(corsAndOrigin);
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });
  app.use(express.json({ limit: '32kb', type: 'application/json' }));

  app.get('/api/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'API route not found.')));

  if (env.isProduction) {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const dist = path.resolve(currentDir, '../../dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*path', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
};
