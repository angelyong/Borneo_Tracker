import type { DbTransaction } from '../db/client.js';

export const writeAudit = (
  tx: DbTransaction,
  values: {
    userId?: string | null;
    eventType: string;
    result: string;
    requestId: string;
    ipHash?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
) => tx.authAuditEvent.create({
  data: {
    userId: values.userId,
    eventType: values.eventType,
    result: values.result,
    requestId: values.requestId,
    ipHash: values.ipHash,
    userAgent: values.userAgent?.slice(0, 500),
    metadata: values.metadata ?? {},
  },
});
