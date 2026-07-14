import { prisma } from '../db/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const cleanupExpiredAuthData = async (now = new Date()) => {
  const usedTokenCutoff = new Date(now.getTime() - 7 * DAY_MS);
  const revokedSessionCutoff = new Date(now.getTime() - 7 * DAY_MS);

  const [sessions, verificationTokens, resetTokens, emailChanges, rateBuckets] = await prisma.$transaction([
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: revokedSessionCutoff } },
        ],
      },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: usedTokenCutoff } }] },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: usedTokenCutoff } }] },
    }),
    prisma.emailChangeRequest.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: usedTokenCutoff } }] },
    }),
    prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  return {
    sessions: sessions.count,
    verificationTokens: verificationTokens.count,
    resetTokens: resetTokens.count,
    emailChanges: emailChanges.count,
    rateBuckets: rateBuckets.count,
  };
};
