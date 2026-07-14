import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/client.js';

const server = createServer(createApp());
server.listen(env.PORT, () => console.info(JSON.stringify({ level: 'info', event: 'SERVER_STARTED', port: env.PORT })));

const shutdown = (signal: string) => {
  console.info(JSON.stringify({ level: 'info', event: 'SERVER_STOPPING', signal }));
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
