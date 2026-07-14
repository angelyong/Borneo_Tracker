import { describe, expect, it } from 'vitest';
import { decryptPayload, encryptPayload, randomToken, sha256 } from '../../src/security/crypto.js';
import { normalizeEmail } from '../../src/modules/auth/normalization.js';
import { hashPassword, needsPasswordRehash, verifyPassword } from '../../src/modules/auth/password.js';

describe('authentication primitives', () => {
  it('normalizes email without provider-specific rewriting', () => {
    expect(normalizeEmail('  Person+tag@Example.COM ')).toBe('person+tag@example.com');
  });
  it('rejects control characters', () => {
    expect(() => normalizeEmail('a\u0000@example.com')).toThrow();
  });
  it('creates high-entropy, hashable tokens', () => {
    const first = randomToken(); const second = randomToken();
    expect(first).toHaveLength(43); expect(first).not.toBe(second); expect(sha256(first)).toHaveLength(64);
  });
  it('round-trips authenticated outbox encryption and rejects tampering', () => {
    const encrypted = encryptPayload({ token: 'secret' });
    expect(encrypted.ciphertext).not.toContain('secret');
    expect(decryptPayload(encrypted.ciphertext, encrypted.keyVersion)).toEqual({ token: 'secret' });
    const bytes = Buffer.from(encrypted.ciphertext, 'base64url'); bytes[bytes.length - 1] ^= 1;
    expect(() => decryptPayload(bytes.toString('base64url'), encrypted.keyVersion)).toThrow();
  });
  it('stores passwords as Argon2id and verifies them', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toContain('$argon2id$');
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password')).toBe(false);
    expect(needsPasswordRehash(hash)).toBe(false);
  });
});
