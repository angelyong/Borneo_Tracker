import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { decryptPayload, suppressionLookups } from '../security/crypto.js';
import { normalizeEmail } from '../modules/auth/normalization.js';
import type { EmailPayload } from './outbox.js';
import { emailProvider } from './provider.js';
import { renderEmail } from './templates.js';

const MAX_ATTEMPTS = 5;
const PERMANENT_ERROR_CODES = new Set(['INVALID_ENCRYPTED_PAYLOAD', 'OUTBOX_KEY_VERSION_UNKNOWN', 'EMAIL_TOKEN_MISSING']);
const SMTP_ERROR_CODES = new Set(['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EENVELOPE', 'EMESSAGE', 'ESTREAM']);

const safeProviderErrorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (PERMANENT_ERROR_CODES.has(message) || message === 'EMAIL_PROVIDER_TIMEOUT') return message;
  const providerCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  return SMTP_ERROR_CODES.has(providerCode) ? `SMTP_${providerCode}` : 'EMAIL_PROVIDER_ERROR';
};

export const processOutboxBatch = async () => {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.emailOutbox.updateMany({
      where: { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
      data: { attemptCount: { increment: 1 }, lastErrorCode: 'STALE_LOCK_RECOVERED' },
    });
    await tx.emailOutbox.updateMany({
      where: { status: 'PROCESSING', lockedAt: { lt: staleBefore }, attemptCount: { gte: MAX_ATTEMPTS } },
      data: { status: 'DEAD', encryptedPayload: null, lockedAt: null, claimId: null },
    });
    await tx.emailOutbox.updateMany({
      where: { status: 'PROCESSING', lockedAt: { lt: staleBefore }, attemptCount: { lt: MAX_ATTEMPTS } },
      data: { status: 'PENDING', lockedAt: null, claimId: null, nextAttemptAt: new Date() },
    });
  });
  const claimId = randomUUID();
  const ids = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM email_outbox
      WHERE status = 'PENDING' AND next_attempt_at <= NOW()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 10
    `);
    if (rows.length) await tx.emailOutbox.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: 'PROCESSING', lockedAt: new Date(), claimId } });
    return rows.map((row) => row.id);
  });

  for (const id of ids) {
    const item = await prisma.emailOutbox.findFirst({ where: { id, status: 'PROCESSING', claimId } });
    if (!item) continue;
    if (!item.encryptedPayload) {
      await prisma.emailOutbox.updateMany({
        where: { id, status: 'PROCESSING', claimId },
        data: { status: 'DEAD', lockedAt: null, claimId: null, lastErrorCode: 'OUTBOX_PAYLOAD_MISSING' },
      });
      continue;
    }
    try {
      const lookups = suppressionLookups(normalizeEmail(item.recipient));
      const suppressed = await prisma.emailSuppression.findFirst({ where: { recipientLookupHmac: { in: lookups }, clearedAt: null } });
      if (suppressed) {
        await prisma.emailOutbox.updateMany({ where: { id, status: 'PROCESSING', claimId }, data: { status: 'DEAD', encryptedPayload: null, lockedAt: null, claimId: null, lastErrorCode: 'EMAIL_SUPPRESSED' } });
        continue;
      }
      const payload = decryptPayload<EmailPayload>(item.encryptedPayload, item.keyVersion);
      const providerMessageId = await Promise.race([
        emailProvider.send(renderEmail(item.recipient, payload), item.id),
        new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('EMAIL_PROVIDER_TIMEOUT')), 30_000)),
      ]);
      await prisma.emailOutbox.updateMany({ where: { id, status: 'PROCESSING', claimId }, data: { status: 'SENT', sentAt: new Date(), providerMessageId, encryptedPayload: null, lockedAt: null, claimId: null, lastErrorCode: null } });
    } catch (error) {
      const attempts = item.attemptCount + 1;
      const errorCode = safeProviderErrorCode(error);
      const isDead = attempts >= MAX_ATTEMPTS || PERMANENT_ERROR_CODES.has(errorCode);
      await prisma.emailOutbox.updateMany({
        where: { id, status: 'PROCESSING', claimId },
        data: {
          status: isDead ? 'DEAD' : 'PENDING',
          attemptCount: attempts,
          encryptedPayload: isDead ? null : undefined,
          nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 30) * 1000),
          lockedAt: null,
          claimId: null,
          lastErrorCode: errorCode,
        },
      });
    }
  }
  return ids.length;
};
