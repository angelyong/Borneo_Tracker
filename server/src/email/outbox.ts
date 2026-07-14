import { randomUUID } from 'node:crypto';
import type { DbTransaction } from '../db/client.js';
import { encryptPayload } from '../security/crypto.js';

export type EmailAction = 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'CONFIRM_EMAIL_CHANGE' | 'PASSWORD_CHANGED' | 'EMAIL_CHANGED';
export type EmailPayload = { action: EmailAction; token?: string; firstName?: string; oldEmail?: string };

export const enqueueEmail = (
  tx: DbTransaction,
  input: { eventType: EmailAction; recipient: string; payload: EmailPayload; dedupeKey?: string },
) => {
  const encrypted = encryptPayload(input.payload);
  return tx.emailOutbox.create({ data: {
    eventType: input.eventType,
    recipient: input.recipient,
    encryptedPayload: encrypted.ciphertext,
    keyVersion: encrypted.keyVersion,
    dedupeKey: input.dedupeKey ?? `${input.eventType}:${randomUUID()}`,
  } });
};
