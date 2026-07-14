import 'dotenv/config';
import { z } from 'zod';

const base64Key = z.string().transform((value, ctx) => {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    ctx.addIssue({ code: 'custom', message: 'Must be a base64-encoded 32-byte key' });
    return z.NEVER;
  }
  return key;
});

const keyring = z.string().transform((value, ctx) => {
  try {
    const parsed = JSON.parse(value) as { active?: string; keys?: Record<string, string> };
    if (!parsed.active || !parsed.keys?.[parsed.active]) throw new Error('Active key is missing');
    const keys = Object.fromEntries(Object.entries(parsed.keys).map(([version, encoded]) => {
      const key = Buffer.from(encoded, 'base64');
      if (!/^[a-zA-Z0-9_-]{1,20}$/.test(version) || key.length !== 32) throw new Error('Invalid keyring entry');
      return [version, key];
    }));
    return { active: parsed.active, keys };
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Must be JSON with active and base64-encoded 32-byte keys' });
    return z.NEVER;
  }
});

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  APP_PUBLIC_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().min(1),
  CSRF_SECRET: z.string().min(32),
  OUTBOX_ENCRYPTION_KEYRING: keyring,
  FINGERPRINT_HMAC_KEY: base64Key,
  SUPPRESSION_LOOKUP_HMAC_KEYRING: keyring.optional(),
  SUPPRESSION_LOOKUP_HMAC_KEY: base64Key.optional(),
  PII_ENCRYPTION_KEYRING: keyring.optional(),
  PII_ENCRYPTION_KEY: base64Key.optional(),
  EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('smtp'),
  EMAIL_FROM: z.string().min(3),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PUBLIC_REGISTRATION_ENABLED: z.string().default('true').transform((v) => v === 'true'),
}).transform((value, ctx) => {
  const suppressionKeyring = value.SUPPRESSION_LOOKUP_HMAC_KEYRING ?? (value.SUPPRESSION_LOOKUP_HMAC_KEY
    ? { active: 'v1', keys: { v1: value.SUPPRESSION_LOOKUP_HMAC_KEY } }
    : null);
  const piiKeyring = value.PII_ENCRYPTION_KEYRING ?? (value.PII_ENCRYPTION_KEY
    ? { active: 'v1', keys: { v1: value.PII_ENCRYPTION_KEY } }
    : null);
  if (!suppressionKeyring) ctx.addIssue({ code: 'custom', path: ['SUPPRESSION_LOOKUP_HMAC_KEYRING'], message: 'A suppression lookup keyring is required' });
  if (!piiKeyring) ctx.addIssue({ code: 'custom', path: ['PII_ENCRYPTION_KEYRING'], message: 'A PII encryption keyring is required' });
  if (!suppressionKeyring || !piiKeyring) return z.NEVER;
  return { ...value, SUPPRESSION_LOOKUP_HMAC_KEYRING: suppressionKeyring, PII_ENCRYPTION_KEYRING: piiKeyring };
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return;
  if (!value.APP_PUBLIC_URL.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['APP_PUBLIC_URL'], message: 'Production requires HTTPS' });
  for (const origin of value.ALLOWED_ORIGINS.split(',')) {
    if (!origin.trim().startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'Production origins require HTTPS' });
  }
  if (value.EMAIL_PROVIDER === 'console') ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'Console email is forbidden in production' });
  if (value.EMAIL_PROVIDER === 'smtp' && (!value.SMTP_USER || !value.SMTP_PASSWORD)) {
    ctx.addIssue({ code: 'custom', path: ['SMTP_USER'], message: 'Authenticated SMTP credentials are required in production' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid server environment: ${details}`);
}

const publicUrl = new URL(parsed.data.APP_PUBLIC_URL);
const allowedOrigins = new Set(parsed.data.ALLOWED_ORIGINS.split(',').map((value) => new URL(value.trim()).origin));

export const env = {
  ...parsed.data,
  APP_PUBLIC_URL: publicUrl.origin,
  ALLOWED_ORIGINS: allowedOrigins,
  isProduction: parsed.data.NODE_ENV === 'production',
};
