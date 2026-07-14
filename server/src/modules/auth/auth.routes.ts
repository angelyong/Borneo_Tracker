import { Router } from 'express';
import { prisma } from '../../db/client.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { ApiError } from '../../http/errors.js';
import { issueCsrf, verifyCsrf, verifyLogoutCsrf } from '../../middleware/csrf.js';
import { enforceRateLimit } from '../../security/rateLimit.js';
import { hmac } from '../../security/crypto.js';
import { changePassword, forgotPassword, login, logoutAll, register, resendVerification, resetPassword, revokeSession, verifyEmail } from './auth.service.js';
import { changePasswordSchema, currentPasswordSchema, emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema } from './schemas.js';
import { clearPreAuthCookie, clearSessionCookie, publicUser, requireAuthentication, resolveSession, setSessionCookie } from './session.js';

export const authRouter = Router();

authRouter.get('/csrf', asyncHandler(async (req, res) => {
  res.json({ csrfToken: await issueCsrf(req, res) });
}));

authRouter.post('/register', verifyCsrf, asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  await enforceRateLimit(req, res, 'register', input.email.normalized, 8, 3600);
  res.status(202).json(await register(input, req));
}));

authRouter.post('/resend-verification', verifyCsrf, asyncHandler(async (req, res) => {
  const { email } = emailOnlySchema.parse(req.body);
  await enforceRateLimit(req, res, 'resend', email.normalized, 5, 86400);
  res.status(202).json(await resendVerification(email, req));
}));

authRouter.post('/verify-email', verifyCsrf, asyncHandler(async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  await enforceRateLimit(req, res, 'verify', token, 15, 900);
  res.json(await verifyEmail(token, req));
}));

authRouter.post('/login', verifyCsrf, asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  await enforceRateLimit(req, res, 'login', input.email.normalized, 10, 900);
  const result = await login(input, req);
  clearPreAuthCookie(res);
  setSessionCookie(res, result.rawToken, result.expiresAt);
  res.json({ user: result.user, csrfToken: hmac('auth', result.rawToken) });
}));

authRouter.get('/me', asyncHandler(async (req, res) => {
  const auth = await resolveSession(req);
  if (!auth) throw new ApiError(401, 'SESSION_INVALID', 'Please sign in to continue.');
  res.json({ user: publicUser(auth.user) });
}));

authRouter.post('/logout', verifyLogoutCsrf, asyncHandler(async (req, res) => {
  await revokeSession(req);
  clearSessionCookie(res);
  clearPreAuthCookie(res);
  res.sendStatus(204);
}));

authRouter.post('/logout-all', verifyCsrf, asyncHandler(async (req, res) => {
  const auth = await requireAuthentication(req);
  const { currentPassword } = currentPasswordSchema.parse(req.body);
  await enforceRateLimit(req, res, 'logout-all', auth.user.id, 5, 3600);
  await logoutAll(auth.user.id, currentPassword, req);
  clearSessionCookie(res);
  clearPreAuthCookie(res);
  res.sendStatus(204);
}));

authRouter.post('/forgot-password', verifyCsrf, asyncHandler(async (req, res) => {
  const { email } = emailOnlySchema.parse(req.body);
  await enforceRateLimit(req, res, 'forgot', email.normalized, 5, 3600);
  res.status(202).json(await forgotPassword(email, req));
}));

authRouter.post('/reset-password', verifyCsrf, asyncHandler(async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await enforceRateLimit(req, res, 'reset', input.token, 10, 900);
  const result = await resetPassword(input.token, input.password, req);
  clearSessionCookie(res);
  clearPreAuthCookie(res);
  res.json(result);
}));

authRouter.post('/change-password', verifyCsrf, asyncHandler(async (req, res) => {
  const auth = await requireAuthentication(req);
  const input = changePasswordSchema.parse(req.body);
  await enforceRateLimit(req, res, 'change-password', auth.user.id, 5, 3600);
  const result = await changePassword(auth.user.id, input.currentPassword, input.password, req);
  clearPreAuthCookie(res);
  setSessionCookie(res, result.rawToken, result.expiresAt);
  res.json({ csrfToken: hmac('auth', result.rawToken) });
}));
