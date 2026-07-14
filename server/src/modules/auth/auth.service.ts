import { Prisma, type User } from '@prisma/client';
import type { Request } from 'express';
import { env } from '../../config/env.js';
import { prisma, type DbTransaction } from '../../db/client.js';
import { enqueueEmail } from '../../email/outbox.js';
import { ApiError, invalidToken } from '../../http/errors.js';
import { fingerprint, randomToken, sha256 } from '../../security/crypto.js';
import { writeAudit } from '../../security/audit.js';
import { createSession, newSessionValues, publicUser } from './session.js';
import { dummyPasswordHash, hashPassword, needsPasswordRehash, verifyPassword } from './password.js';

const VERIFY_MESSAGE = 'If the address can be registered, a verification email will be sent.';
const RESET_MESSAGE = 'If an account matches that email, a password reset link will be sent.';

const context = (req: Request) => ({
  requestId: req.requestId,
  ipHash: req.ip ? fingerprint(req.ip) : null,
  userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
});

const lockUser = async (tx: DbTransaction, userId: string) => {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`);
  return tx.user.findUnique({ where: { id: userId } });
};

const addVerification = async (tx: DbTransaction, user: User) => {
  const raw = randomToken();
  const token = await tx.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  await enqueueEmail(tx, {
    eventType: 'VERIFY_EMAIL',
    recipient: user.email,
    payload: { action: 'VERIFY_EMAIL', token: raw, firstName: user.firstName },
    dedupeKey: `verify:${token.id}`,
  });
};

export const register = async (
  input: { email: { display: string; normalized: string }; password: string; firstName: string; lastName: string },
  req: Request,
) => {
  if (!env.PUBLIC_REGISTRATION_ENABLED) throw new ApiError(503, 'REGISTRATION_DISABLED', 'Registration is temporarily unavailable.');
  const computedHash = await hashPassword(input.password);
  try {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { emailNormalized: input.email.normalized } });
    if (!existing) {
        const user = await tx.user.create({
          data: {
            email: input.email.display,
            emailNormalized: input.email.normalized,
            passwordHash: computedHash,
            firstName: input.firstName,
            lastName: input.lastName,
            profile: { create: {} },
          },
        });
        await addVerification(tx, user);
        await writeAudit(tx, { ...context(req), userId: user.id, eventType: 'REGISTER', result: 'ACCEPTED' });
      return;
    }
    const locked = await lockUser(tx, existing.id);
    if (locked?.status === 'PENDING') {
      const latest = await tx.emailVerificationToken.findFirst({ where: { userId: locked.id }, orderBy: { createdAt: 'desc' } });
      const dailyCount = await tx.emailVerificationToken.count({ where: { userId: locked.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
      if ((!latest || latest.createdAt.getTime() <= Date.now() - 60_000) && dailyCount < 5) {
        await tx.emailVerificationToken.updateMany({ where: { userId: locked.id, usedAt: null }, data: { usedAt: new Date() } });
        await addVerification(tx, locked);
      }
    }
    await writeAudit(tx, { ...context(req), userId: existing.id, eventType: 'REGISTER', result: 'GENERIC_ACCEPTED' });
  });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
  return { message: VERIFY_MESSAGE };
};

export const resendVerification = async (email: { normalized: string }, req: Request) => {
  await verifyPassword(await dummyPasswordHash, 'fixed-resend-timing-work').catch(() => false);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { emailNormalized: email.normalized } });
    if (!user) return;
    const locked = await lockUser(tx, user.id);
    if (!locked || locked.status !== 'PENDING') return;
    const latest = await tx.emailVerificationToken.findFirst({ where: { userId: locked.id }, orderBy: { createdAt: 'desc' } });
    const dailyCount = await tx.emailVerificationToken.count({ where: { userId: locked.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    if (latest && latest.createdAt.getTime() > Date.now() - 60_000 || dailyCount >= 5) return;
    await tx.emailVerificationToken.updateMany({ where: { userId: locked.id, usedAt: null }, data: { usedAt: new Date() } });
    await addVerification(tx, locked);
    await writeAudit(tx, { ...context(req), userId: locked.id, eventType: 'RESEND_VERIFICATION', result: 'ACCEPTED' });
  });
  return { message: VERIFY_MESSAGE };
};

export const verifyEmail = async (rawToken: string, req: Request) => prisma.$transaction(async (tx) => {
  const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!token) throw invalidToken();
  const lockedUser = await lockUser(tx, token.userId);
  if (!lockedUser || lockedUser.status !== 'PENDING' || lockedUser.emailVerifiedAt) throw invalidToken();
  const consumed = await tx.emailVerificationToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) throw invalidToken();
  const user = await tx.user.update({
    where: { id: token.userId },
    data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await writeAudit(tx, { ...context(req), userId: user.id, eventType: 'VERIFY_EMAIL', result: 'SUCCESS' });
  return { verified: true };
});

export const login = async (input: { email: { normalized: string }; password: string }, req: Request) => {
  const initial = await prisma.user.findUnique({ where: { emailNormalized: input.email.normalized } });
  const validPassword = await verifyPassword(initial?.passwordHash ?? await dummyPasswordHash, input.password).catch(() => false);
  if (!initial || !validPassword) {
    await prisma.authAuditEvent.create({ data: { ...context(req), eventType: 'LOGIN', result: 'FAILED', metadata: {} } });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  if (initial.status === 'PENDING') throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.');
  if (initial.status === 'SUSPENDED') throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account is not available.');
  const upgradedHash = needsPasswordRehash(initial.passwordHash) ? await hashPassword(input.password) : null;

  return prisma.$transaction(async (tx) => {
    const current = await lockUser(tx, initial.id);
    if (!current || current.emailNormalized !== input.email.normalized || current.passwordHash !== initial.passwordHash ||
      current.authVersion !== initial.authVersion || current.status !== 'ACTIVE' || !current.emailVerifiedAt) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const created = await createSession(tx, current.id, current.authVersion, req);
    const user = await tx.user.update({
      where: { id: current.id },
      data: { lastLoginAt: new Date(), ...(upgradedHash ? { passwordHash: upgradedHash } : {}) },
    });
    await writeAudit(tx, { ...context(req), userId: user.id, eventType: 'LOGIN', result: 'SUCCESS' });
    return { user: publicUser(user), ...created };
  });
};

export const forgotPassword = async (email: { normalized: string }, req: Request) => {
  await verifyPassword(await dummyPasswordHash, 'fixed-forgot-timing-work').catch(() => false);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { emailNormalized: email.normalized } });
    if (!user) return;
    const locked = await lockUser(tx, user.id);
    if (!locked?.emailVerifiedAt) return;
    await tx.passwordResetToken.updateMany({ where: { userId: locked.id, usedAt: null }, data: { usedAt: new Date() } });
    const raw = randomToken();
    const token = await tx.passwordResetToken.create({ data: { userId: locked.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    await enqueueEmail(tx, { eventType: 'RESET_PASSWORD', recipient: locked.email, payload: { action: 'RESET_PASSWORD', token: raw, firstName: locked.firstName }, dedupeKey: `reset:${token.id}` });
    await writeAudit(tx, { ...context(req), userId: locked.id, eventType: 'FORGOT_PASSWORD', result: 'ACCEPTED' });
  });
  return { message: RESET_MESSAGE };
};

export const resetPassword = async (rawToken: string, password: string, req: Request) => {
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!token) throw invalidToken();
    const user = await lockUser(tx, token.userId);
    if (!user) throw invalidToken();
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw invalidToken();
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date(), authVersion: { increment: 1 } } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await enqueueEmail(tx, { eventType: 'PASSWORD_CHANGED', recipient: user.email, payload: { action: 'PASSWORD_CHANGED', firstName: user.firstName } });
    await writeAudit(tx, { ...context(req), userId: user.id, eventType: 'RESET_PASSWORD', result: 'SUCCESS' });
    return { reset: true };
  });
};

export const changePassword = async (userId: string, currentPassword: string, password: string, req: Request) => {
  const initial = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!await verifyPassword(initial.passwordHash, currentPassword)) throw new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const current = await lockUser(tx, userId);
    if (!current || current.passwordHash !== initial.passwordHash || current.authVersion !== initial.authVersion) throw new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
    const user = await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date(), authVersion: { increment: 1 } } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    const created = await createSession(tx, userId, user.authVersion, req);
    await enqueueEmail(tx, { eventType: 'PASSWORD_CHANGED', recipient: user.email, payload: { action: 'PASSWORD_CHANGED', firstName: user.firstName } });
    await writeAudit(tx, { ...context(req), userId, eventType: 'CHANGE_PASSWORD', result: 'SUCCESS' });
    return { user, ...created };
  });
};

export const logoutAll = async (userId: string, currentPassword: string, req: Request) => {
  const initial = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!await verifyPassword(initial.passwordHash, currentPassword)) throw new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
  await prisma.$transaction(async (tx) => {
    const current = await lockUser(tx, userId);
    if (!current || current.passwordHash !== initial.passwordHash || current.authVersion !== initial.authVersion) throw new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
    await tx.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { ...context(req), userId, eventType: 'LOGOUT_ALL', result: 'SUCCESS' });
  });
};

export const revokeSession = async (req: Request) => {
  if (!req.auth) return;
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({ where: { id: req.auth!.session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { ...context(req), userId: req.auth!.user.id, eventType: 'LOGOUT', result: 'SUCCESS' });
  });
};

export { publicUser };
