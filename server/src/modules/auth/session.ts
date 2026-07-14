import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { prisma, type DbTransaction } from '../../db/client.js';
import { ApiError } from '../../http/errors.js';
import { fingerprint, randomToken, sha256 } from '../../security/crypto.js';

export const SESSION_COOKIE = env.isProduction ? '__Host-bt_session' : 'bt_session';
export const PREAUTH_COOKIE = env.isProduction ? '__Host-bt_pre_auth' : 'bt_pre_auth';
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_MS = 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

export const setSessionCookie = (res: Response, rawToken: string, expiresAt: Date) =>
  res.cookie(SESSION_COOKIE, rawToken, { ...cookieOptions, expires: expiresAt });
export const clearSessionCookie = (res: Response) => res.clearCookie(SESSION_COOKIE, cookieOptions);
export const setPreAuthCookie = (res: Response, rawToken: string) =>
  res.cookie(PREAUTH_COOKIE, rawToken, { ...cookieOptions, maxAge: 2 * 60 * 60 * 1000 });
export const clearPreAuthCookie = (res: Response) => res.clearCookie(PREAUTH_COOKIE, cookieOptions);

export const newSessionValues = (userId: string, authVersion: bigint, req: Request) => {
  const rawToken = randomToken();
  const expiresAt = new Date(Date.now() + ABSOLUTE_MS);
  return {
    rawToken,
    expiresAt,
    data: {
      userId,
      authVersion,
      tokenHash: sha256(rawToken),
      expiresAt,
      userAgent: req.get('user-agent')?.slice(0, 500),
      ipHash: req.ip ? fingerprint(req.ip) : null,
    },
  };
};

export const createSession = async (tx: DbTransaction, userId: string, authVersion: bigint, req: Request) => {
  const values = newSessionValues(userId, authVersion, req);
  const session = await tx.session.create({ data: values.data });
  return { ...values, session };
};

export const resolveSession = async (req: Request) => {
  const rawToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!rawToken || rawToken.length > 100) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(rawToken) }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  const valid = !session.revokedAt && session.expiresAt.getTime() > now && session.lastSeenAt.getTime() + IDLE_MS > now &&
    session.user.status === 'ACTIVE' && Boolean(session.user.emailVerifiedAt) && session.authVersion === session.user.authVersion &&
    session.createdAt.getTime() >= session.user.passwordChangedAt.getTime();
  if (!valid) return null;
  if (session.lastSeenAt.getTime() + 15 * 60 * 1000 < now) {
    void prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return { session, user: session.user, rawToken };
};

export type AuthenticatedSession = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;

export const optionalAuthentication = async (req: Request) => {
  req.auth = (await resolveSession(req)) ?? undefined;
};

export const requireAuthentication = async (req: Request) => {
  const auth = await resolveSession(req);
  if (!auth) throw new ApiError(401, 'SESSION_INVALID', 'Please sign in to continue.');
  req.auth = auth;
  return auth;
};

export const publicUser = (user: { id: string; email: string; firstName: string; lastName: string; role: string; emailVerifiedAt: Date | null }) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  emailVerified: Boolean(user.emailVerifiedAt),
});
