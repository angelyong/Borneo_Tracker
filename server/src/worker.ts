import 'dotenv/config';
import { prisma } from './db/client.js';
import { processOutboxBatch } from './email/worker.service.js';
import { cleanupExpiredAuthData } from './maintenance/cleanup.service.js';

let stopping = false;
let nextCleanupAt = 0;
const run = async () => {
  while (!stopping) {
    try {
      if (Date.now() >= nextCleanupAt) {
        await cleanupExpiredAuthData();
        nextCleanupAt = Date.now() + 60 * 60 * 1000;
      }
      const processed = await processOutboxBatch();
      await new Promise((resolve) => setTimeout(resolve, processed ? 250 : 2000));
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'OUTBOX_WORKER_ERROR', message: error instanceof Error ? error.message : 'unknown' }));
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });
void run().finally(() => prisma.$disconnect());
