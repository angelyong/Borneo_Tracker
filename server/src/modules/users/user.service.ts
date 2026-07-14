import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma, type DbTransaction } from '../../db/client.js';
import { enqueueEmail } from '../../email/outbox.js';
import { ApiError, invalidToken } from '../../http/errors.js';
import { fingerprint, randomToken, sha256 } from '../../security/crypto.js';
import { writeAudit } from '../../security/audit.js';
import { verifyPassword } from '../auth/password.js';
import { createSession, publicUser, type AuthenticatedSession } from '../auth/session.js';

const context = (req: Request) => ({ requestId: req.requestId, ipHash: req.ip ? fingerprint(req.ip) : null, userAgent: req.get('user-agent')?.slice(0, 500) ?? null });

const lockUser = async (tx: DbTransaction, userId: string) => {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`);
  return tx.user.findUnique({ where: { id: userId } });
};

export const getMyProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user?.profile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile was not found.');
  return {
    user: publicUser(user),
    profile: {
      phoneCountryCode: user.profile.phoneCountryCode,
      phoneNumber: user.profile.phoneNumber,
      addressLine: user.profile.addressLine,
      city: user.profile.city,
      state: user.profile.state,
      postalCode: user.profile.postalCode,
    },
    version: user.profile.version,
  };
};

export const updateMyProfile = async (
  userId: string,
  input: {
    version: number;
    firstName?: string;
    lastName?: string;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  },
  req: Request,
) => {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.userProfile.updateMany({
      where: { userId, version: input.version },
      data: {
        version: { increment: 1 },
        ...Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== 'version' && !['firstName', 'lastName'].includes(key) && value !== undefined)),
      },
    });
    if (updated.count !== 1) throw new ApiError(409, 'PROFILE_VERSION_CONFLICT', 'This profile was updated elsewhere. Reload and try again.');
    if (input.firstName !== undefined || input.lastName !== undefined) {
      await tx.user.update({ where: { id: userId }, data: { firstName: input.firstName, lastName: input.lastName } });
    }
    await writeAudit(tx, { ...context(req), userId, eventType: 'PROFILE_UPDATE', result: 'SUCCESS' });
  });
  return getMyProfile(userId);
};

export const requestEmailChange = async (
  userId: string,
  newEmail: { display: string; normalized: string },
  currentPassword: string,
  req: Request,
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!await verifyPassword(user.passwordHash, currentPassword)) throw new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
  await prisma.$transaction(async (tx) => {
    const current = await lockUser(tx, userId);
    if (!current || current.passwordHash !== user.passwordHash || current.authVersion !== user.authVersion) throw new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
    const alreadyUsed = await tx.user.findUnique({ where: { emailNormalized: newEmail.normalized } });
    if (alreadyUsed || newEmail.normalized === current.emailNormalized) return;
    await tx.emailChangeRequest.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    const raw = randomToken();
    const change = await tx.emailChangeRequest.create({
      data: { userId, newEmail: newEmail.display, newEmailNormalized: newEmail.normalized, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    await enqueueEmail(tx, { eventType: 'CONFIRM_EMAIL_CHANGE', recipient: newEmail.display, payload: { action: 'CONFIRM_EMAIL_CHANGE', token: raw, firstName: current.firstName }, dedupeKey: `email-change:${change.id}` });
    await writeAudit(tx, { ...context(req), userId, eventType: 'EMAIL_CHANGE_REQUEST', result: 'ACCEPTED' });
  });
  return { message: 'If the new address can be used, a confirmation email will be sent.' };
};

export const confirmEmailChange = async (auth: AuthenticatedSession, rawToken: string, req: Request) => {
  const userId = auth.user.id;
  try {
    return await prisma.$transaction(async (tx) => {
      const token = await tx.emailChangeRequest.findUnique({ where: { tokenHash: sha256(rawToken) } });
      if (!token) throw invalidToken();
      if (token.userId !== userId) throw new ApiError(403, 'TOKEN_USER_MISMATCH', 'This link belongs to a different account.');
      const user = await lockUser(tx, userId);
      if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'SESSION_INVALID', 'Please sign in to continue.');
      const currentSession = await tx.session.findUnique({ where: { id: auth.session.id } });
      const now = Date.now();
      const sessionStillValid = currentSession && !currentSession.revokedAt &&
        currentSession.expiresAt.getTime() > now && currentSession.lastSeenAt.getTime() + 24 * 60 * 60 * 1000 > now &&
        currentSession.authVersion === auth.session.authVersion && currentSession.authVersion === user.authVersion &&
        auth.user.authVersion === user.authVersion && currentSession.createdAt.getTime() >= user.passwordChangedAt.getTime();
      if (!sessionStillValid) throw new ApiError(401, 'SESSION_INVALID', 'Please sign in to continue.');
      const consumed = await tx.emailChangeRequest.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) throw invalidToken();
      const existing = await tx.user.findUnique({ where: { emailNormalized: token.newEmailNormalized } });
      if (existing && existing.id !== userId) throw new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'That email address cannot be used.');
      const changed = await tx.user.update({ where: { id: userId }, data: { email: token.newEmail, emailNormalized: token.newEmailNormalized, authVersion: { increment: 1 } } });
      await tx.emailChangeRequest.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      const session = await createSession(tx, userId, changed.authVersion, req);
      await enqueueEmail(tx, { eventType: 'EMAIL_CHANGED', recipient: user.email, payload: { action: 'EMAIL_CHANGED', firstName: user.firstName, oldEmail: user.email } });
      await enqueueEmail(tx, { eventType: 'EMAIL_CHANGED', recipient: changed.email, payload: { action: 'EMAIL_CHANGED', firstName: changed.firstName, oldEmail: user.email } });
      await writeAudit(tx, { ...context(req), userId, eventType: 'EMAIL_CHANGE_CONFIRM', result: 'SUCCESS' });
      return { user: publicUser(changed), ...session };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'That email address cannot be used.');
    throw error;
  }
};
