import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { hmac } from '../../security/crypto.js';
import { enforceRateLimit } from '../../security/rateLimit.js';
import { changeEmailSchema, tokenSchema } from '../auth/schemas.js';
import { requireAuthentication, setSessionCookie } from '../auth/session.js';
import { updateProfileSchema } from './schemas.js';
import { confirmEmailChange, getMyProfile, requestEmailChange, updateMyProfile } from './user.service.js';

export const userRouter = Router();

userRouter.get('/me', asyncHandler(async (req, res) => {
  const auth = await requireAuthentication(req);
  res.json(await getMyProfile(auth.user.id));
}));

userRouter.patch('/me', verifyCsrf, asyncHandler(async (req, res) => {
  const auth = await requireAuthentication(req);
  const input = updateProfileSchema.parse(req.body);
  res.json(await updateMyProfile(auth.user.id, input, req));
}));

userRouter.post('/me/change-email', verifyCsrf, asyncHandler(async (req, res) => {
  const auth = await requireAuthentication(req);
  const input = changeEmailSchema.parse(req.body);
  await enforceRateLimit(req, res, 'change-email', auth.user.id, 5, 3600);
  res.status(202).json(await requestEmailChange(auth.user.id, input.newEmail, input.currentPassword, req));
}));

userRouter.post('/me/confirm-email-change', verifyCsrf, asyncHandler(async (req, res) => {
  const auth = await requireAuthentication(req);
  const { token } = tokenSchema.parse(req.body);
  const result = await confirmEmailChange(auth, token, req);
  setSessionCookie(res, result.rawToken, result.expiresAt);
  res.json({ user: result.user, csrfToken: hmac('auth', result.rawToken) });
}));
