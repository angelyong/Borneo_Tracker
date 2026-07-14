import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const hmac = (context: string, value: string) =>
  createHmac('sha256', env.CSRF_SECRET).update(`${context}:${value}`).digest('base64url');
export const fingerprint = (value: string) => createHmac('sha256', env.FINGERPRINT_HMAC_KEY).update(value).digest('hex');
export const suppressionLookup = (emailNormalized: string) => createHmac(
  'sha256',
  env.SUPPRESSION_LOOKUP_HMAC_KEYRING.keys[env.SUPPRESSION_LOOKUP_HMAC_KEYRING.active],
).update(emailNormalized).digest('hex');
export const suppressionLookups = (emailNormalized: string) => Object.values(env.SUPPRESSION_LOOKUP_HMAC_KEYRING.keys)
  .map((key) => createHmac('sha256', key).update(emailNormalized).digest('hex'));

export const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const encryptWithKey = (payload: unknown, key: Buffer) => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
};

const decryptWithKey = <T>(value: string, key: Buffer): T => {
  try {
    const envelope = Buffer.from(value, 'base64url');
    if (envelope.length < 29) throw new Error('INVALID_ENCRYPTED_PAYLOAD');
    const nonce = envelope.subarray(0, 12);
    const tag = envelope.subarray(12, 28);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(envelope.subarray(28)), decipher.final()]).toString('utf8')) as T;
  } catch {
    throw new Error('INVALID_ENCRYPTED_PAYLOAD');
  }
};

export const encryptPayload = (payload: unknown) => ({
  ciphertext: encryptWithKey(payload, env.OUTBOX_ENCRYPTION_KEYRING.keys[env.OUTBOX_ENCRYPTION_KEYRING.active]),
  keyVersion: env.OUTBOX_ENCRYPTION_KEYRING.active,
});
export const decryptPayload = <T>(value: string, keyVersion = env.OUTBOX_ENCRYPTION_KEYRING.active): T => {
  const key = env.OUTBOX_ENCRYPTION_KEYRING.keys[keyVersion];
  if (!key) throw new Error('OUTBOX_KEY_VERSION_UNKNOWN');
  return decryptWithKey<T>(value, key);
};
export const encryptPii = (value: string) => ({
  ciphertext: encryptWithKey(value, env.PII_ENCRYPTION_KEYRING.keys[env.PII_ENCRYPTION_KEYRING.active]),
  keyVersion: env.PII_ENCRYPTION_KEYRING.active,
});
export const decryptPii = (value: string, keyVersion: string) => {
  const key = env.PII_ENCRYPTION_KEYRING.keys[keyVersion];
  if (!key) throw new Error('PII_KEY_VERSION_UNKNOWN');
  return decryptWithKey<string>(value, key);
};
