import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../http/errors.js';
import { hmac, randomToken, safeEqual } from '../security/crypto.js';
import { PREAUTH_COOKIE, SESSION_COOKIE, clearPreAuthCookie, resolveSession, setPreAuthCookie } from '../modules/auth/session.js';

export const issueCsrf = async (req: Request, res: Response) => {
  const auth = await resolveSession(req);
  if (auth) return hmac('auth', auth.rawToken);
  let rawToken = req.cookies?.[PREAUTH_COOKIE] as string | undefined;
  if (!rawToken || rawToken.length > 100) {
    rawToken = randomToken();
    setPreAuthCookie(res, rawToken);
  }
  return hmac('preauth', rawToken);
};

export const verifyCsrf = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const supplied = req.header('x-csrf-token');
    if (!supplied) throw new ApiError(403, 'CSRF_INVALID', 'Security token is missing or invalid.');
    const auth = await resolveSession(req);
    const preauth = req.cookies?.[PREAUTH_COOKIE] as string | undefined;
    const expected = auth ? hmac('auth', auth.rawToken) : preauth ? hmac('preauth', preauth) : '';
    if (!expected || !safeEqual(expected, supplied)) throw new ApiError(403, 'CSRF_INVALID', 'Security token is missing or invalid.');
    if (auth) req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
};

export const verifyLogoutCsrf = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const rawSession = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const preauth = req.cookies?.[PREAUTH_COOKIE] as string | undefined;
    if (!rawSession && !preauth) return next();
    const supplied = req.header('x-csrf-token');
    if (!supplied) throw new ApiError(403, 'CSRF_INVALID', 'Security token is missing or invalid.');
    const auth = await resolveSession(req);
    const candidates = [
      ...(rawSession ? [hmac('auth', rawSession)] : []),
      ...(preauth ? [hmac('preauth', preauth)] : []),
    ];
    if (!candidates.some((candidate) => safeEqual(candidate, supplied))) throw new ApiError(403, 'CSRF_INVALID', 'Security token is missing or invalid.');
    if (auth) req.auth = auth;
    next();
  } catch (error) { next(error); }
};

export { clearPreAuthCookie };
