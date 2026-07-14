import { z } from 'zod';
import { normalizeEmail } from './normalization.js';

const email = z.string().max(256).transform((value) => value.trim()).pipe(z.string().max(254).email()).transform((value, ctx) => {
  try {
    return { display: value.trim(), normalized: normalizeEmail(value) };
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email address.' });
    return z.NEVER;
  }
});
const boundedPassword = z.string().superRefine((value, ctx) => {
  const length = [...value].length;
  if (length > 128) ctx.addIssue({ code: 'too_big', origin: 'string', maximum: 128, inclusive: true, message: 'Password must contain no more than 128 characters.' });
});
const password = boundedPassword.superRefine((value, ctx) => {
  if ([...value].length < 12) ctx.addIssue({ code: 'too_small', origin: 'string', minimum: 12, inclusive: true, message: 'Password must contain at least 12 characters.' });
});
const name = z.string().trim().min(1).max(100);

export const registerSchema = z.object({ email, password, firstName: name, lastName: name }).strict();
export const loginSchema = z.object({ email, password: boundedPassword }).strict();
export const emailOnlySchema = z.object({ email }).strict();
export const tokenSchema = z.object({ token: z.string().min(40).max(100) }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(40).max(100), password, confirmPassword: boundedPassword }).strict().refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
export const currentPasswordSchema = z.object({ currentPassword: boundedPassword }).strict();
export const changePasswordSchema = z.object({ currentPassword: boundedPassword, password, confirmPassword: boundedPassword }).strict().refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
export const changeEmailSchema = z.object({ newEmail: email, currentPassword: boundedPassword }).strict();
