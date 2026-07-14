import supertest from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/client.js';
import { decryptPayload, encryptPii, suppressionLookup } from '../../src/security/crypto.js';
import type { EmailPayload } from '../../src/email/outbox.js';
import { processOutboxBatch } from '../../src/email/worker.service.js';
import { emailProvider } from '../../src/email/provider.js';
import { confirmEmailChange } from '../../src/modules/users/user.service.js';

const origin = 'http://localhost:5173';
const app = createApp();

type Agent = ReturnType<typeof supertest.agent>;
const csrf = async (agent: Agent) => {
  const response = await agent.get('/api/auth/csrf').expect(200);
  return response.body.csrfToken as string;
};
const post = (agent: Agent, path: string, token: string, body: Record<string, unknown>) =>
  agent.post(path).set('Origin', origin).set('X-CSRF-Token', token).set('Content-Type', 'application/json').send(body);
const clearDatabase = () => {
  const database = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (process.env.NODE_ENV !== 'test' || !database.endsWith('_test')) {
    throw new Error(`Refusing to truncate non-test database: ${database}`);
  }
  return prisma.$executeRawUnsafe(`TRUNCATE TABLE
  auth_audit_events, email_suppressions, email_outbox, email_change_requests, password_reset_tokens,
  email_verification_tokens, sessions, user_profiles, users, rate_limit_buckets CASCADE`);
};
const latestToken = async (eventType: string) => {
  const item = await prisma.emailOutbox.findFirstOrThrow({ where: { eventType }, orderBy: { createdAt: 'desc' } });
  return decryptPayload<EmailPayload>(item.encryptedPayload!, item.keyVersion).token!;
};

beforeEach(async () => { await clearDatabase(); });
afterAll(async () => { await clearDatabase(); await prisma.$disconnect(); });

describe('complete auth flow', () => {
  it('registers, verifies, logs in, updates profile, resets password and revokes the old session', async () => {
    const guest = supertest.agent(app);
    let guestCsrf = await csrf(guest);
    const registration = { email: ' Test.User@Example.com ', password: 'a very secure password', firstName: 'Test', lastName: 'User' };
    const registered = await post(guest, '/api/auth/register', guestCsrf, registration).expect(202);
    expect(registered.body.message).toMatch(/verification/i);
    const stored = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: 'test.user@example.com' } });
    expect(stored.passwordHash).not.toBe(registration.password);
    expect(stored.status).toBe('PENDING');

    const verifyToken = await latestToken('VERIFY_EMAIL');
    await post(guest, '/api/auth/verify-email', guestCsrf, { token: verifyToken }).expect(200, { verified: true });
    await post(guest, '/api/auth/verify-email', guestCsrf, { token: verifyToken }).expect(400);

    const browser = supertest.agent(app);
    let browserCsrf = await csrf(browser);
    const login = await post(browser, '/api/auth/login', browserCsrf, { email: registration.email, password: registration.password }).expect(200);
    const cookies = Array.isArray(login.headers['set-cookie']) ? login.headers['set-cookie'] : [login.headers['set-cookie']];
    expect(cookies.find((cookie: string) => cookie.startsWith('bt_session='))).toMatch(/bt_session=.*HttpOnly.*SameSite=Lax/i);
    browserCsrf = login.body.csrfToken;
    const me = await browser.get('/api/auth/me').expect(200);
    expect(me.body.user).toMatchObject({ email: 'Test.User@Example.com', firstName: 'Test' });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');

    const profile = await browser.get('/api/users/me').expect(200);
    const updated = await browser.patch('/api/users/me').set('Origin', origin).set('X-CSRF-Token', browserCsrf).set('Content-Type', 'application/json').send({ version: profile.body.version, city: 'Kuching', postalCode: '93000' }).expect(200);
    expect(updated.body.profile).toMatchObject({ city: 'Kuching', postalCode: '93000' });
    await browser.patch('/api/users/me').set('Origin', origin).set('X-CSRF-Token', browserCsrf).set('Content-Type', 'application/json').send({ version: profile.body.version, city: 'Stale update' }).expect(409);

    const resetGuest = supertest.agent(app);
    const resetCsrf = await csrf(resetGuest);
    const forgot = await post(resetGuest, '/api/auth/forgot-password', resetCsrf, { email: registration.email }).expect(202);
    const missing = await post(resetGuest, '/api/auth/forgot-password', resetCsrf, { email: 'missing@example.com' }).expect(202);
    expect(forgot.body).toEqual(missing.body);
    const resetToken = await latestToken('RESET_PASSWORD');
    await post(resetGuest, '/api/auth/reset-password', resetCsrf, { token: resetToken, password: 'an even safer password', confirmPassword: 'an even safer password' }).expect(200, { reset: true });
    await browser.get('/api/auth/me').expect(401);

    const newBrowser = supertest.agent(app);
    const newCsrf = await csrf(newBrowser);
    await post(newBrowser, '/api/auth/login', newCsrf, { email: registration.email, password: registration.password }).expect(401);
    await post(newBrowser, '/api/auth/login', newCsrf, { email: registration.email, password: 'an even safer password' }).expect(200);
  });

  it('keeps public responses generic and consumes verification tokens once under concurrency', async () => {
    const first = supertest.agent(app); const token = await csrf(first);
    const body = { email: 'race@example.com', password: 'a secure race password', firstName: 'Race', lastName: 'Test' };
    const created = await post(first, '/api/auth/register', token, body).expect(202);
    const duplicate = await post(first, '/api/auth/register', token, body).expect(202);
    expect(created.body).toEqual(duplicate.body);
    const raw = await latestToken('VERIFY_EMAIL');
    const outcomes = await Promise.all([
      post(first, '/api/auth/verify-email', token, { token: raw }),
      post(first, '/api/auth/verify-email', token, { token: raw }),
    ]);
    expect(outcomes.map((result) => result.status).sort()).toEqual([200, 400]);
  });

  it('requires exact origin, JSON and CSRF for browser writes', async () => {
    const agent = supertest.agent(app); const token = await csrf(agent);
    const body = { email: 'security@example.com', password: 'a secure test password', firstName: 'Sec', lastName: 'Test' };
    await agent.post('/api/auth/register').set('X-CSRF-Token', token).send(body).expect(403);
    await agent.post('/api/auth/register').set('Origin', 'https://evil.example').set('X-CSRF-Token', token).send(body).expect(403);
    await agent.post('/api/auth/register').set('Origin', origin).set('Content-Type', 'application/json').send(body).expect(403);
  });

  it('keeps verification and reset token rate-limit buckets isolated per token', async () => {
    const agent = supertest.agent(app); const token = await csrf(agent);
    const tokenA = 'a'.repeat(43); const tokenB = 'b'.repeat(43);
    await post(agent, '/api/auth/verify-email', token, { token: tokenA }).expect(400);
    await post(agent, '/api/auth/verify-email', token, { token: tokenB }).expect(400);
    await post(agent, '/api/auth/reset-password', token, { token: tokenA, password: 'replacement password one', confirmPassword: 'replacement password one' }).expect(400);
    await post(agent, '/api/auth/reset-password', token, { token: tokenB, password: 'replacement password two', confirmPassword: 'replacement password two' }).expect(400);

    const verifyBuckets = await prisma.rateLimitBucket.findMany({ where: { key: { startsWith: 'verify:subject:' } } });
    const resetBuckets = await prisma.rateLimitBucket.findMany({ where: { key: { startsWith: 'reset:subject:' } } });
    expect(verifyBuckets).toHaveLength(2);
    expect(resetBuckets).toHaveLength(2);
    expect(verifyBuckets.every((bucket) => bucket.count === 1)).toBe(true);
    expect(resetBuckets.every((bucket) => bucket.count === 1)).toBe(true);
  });

  it('delivers encrypted outbox messages and erases the sensitive payload', async () => {
    const agent = supertest.agent(app); const token = await csrf(agent);
    await post(agent, '/api/auth/register', token, { email: 'mail@example.com', password: 'a secure mail password', firstName: 'Mail', lastName: 'Test' }).expect(202);
    const count = await processOutboxBatch();
    expect(count).toBe(1);
    const sent = await prisma.emailOutbox.findFirstOrThrow();
    expect(sent.status).toBe('SENT'); expect(sent.encryptedPayload).toBeNull(); expect(sent.providerMessageId).toBeTruthy();
  });

  it('rotates sessions for password/email changes and supports sign-out-all', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'account@example.com'; const oldPassword = 'original secure password'; const newPassword = 'replacement secure password';
    await post(guest, '/api/auth/register', guestToken, { email, password: oldPassword, firstName: 'Account', lastName: 'Owner' }).expect(202);
    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);

    const firstDevice = supertest.agent(app); let firstCsrf = await csrf(firstDevice);
    firstCsrf = (await post(firstDevice, '/api/auth/login', firstCsrf, { email, password: oldPassword }).expect(200)).body.csrfToken;
    const secondDevice = supertest.agent(app); let secondCsrf = await csrf(secondDevice);
    secondCsrf = (await post(secondDevice, '/api/auth/login', secondCsrf, { email, password: oldPassword }).expect(200)).body.csrfToken;

    const changedPassword = await post(firstDevice, '/api/auth/change-password', firstCsrf, { currentPassword: oldPassword, password: newPassword, confirmPassword: newPassword }).expect(200);
    firstCsrf = changedPassword.body.csrfToken;
    await firstDevice.get('/api/auth/me').expect(200);
    await secondDevice.get('/api/auth/me').expect(401);

    await post(firstDevice, '/api/users/me/change-email', firstCsrf, { newEmail: 'new.account@example.com', currentPassword: newPassword }).expect(202);
    const emailToken = await latestToken('CONFIRM_EMAIL_CHANGE');
    const changedEmail = await post(firstDevice, '/api/users/me/confirm-email-change', firstCsrf, { token: emailToken }).expect(200);
    firstCsrf = changedEmail.body.csrfToken;
    expect(changedEmail.body.user.email).toBe('new.account@example.com');
    await post(firstDevice, '/api/auth/logout-all', firstCsrf, { currentPassword: newPassword }).expect(204);
    await firstDevice.get('/api/auth/me').expect(401);

    const finalDevice = supertest.agent(app); const finalCsrf = await csrf(finalDevice);
    await post(finalDevice, '/api/auth/login', finalCsrf, { email, password: newPassword }).expect(401);
    await post(finalDevice, '/api/auth/login', finalCsrf, { email: 'new.account@example.com', password: newPassword }).expect(200);
  });

  it('does not confirm an email change from an authentication snapshot revoked concurrently', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'stale-confirm@example.com'; const password = 'stale confirm password';
    await post(guest, '/api/auth/register', guestToken, { email, password, firstName: 'Stale', lastName: 'Confirm' }).expect(202);
    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);

    const browser = supertest.agent(app); let browserToken = await csrf(browser);
    browserToken = (await post(browser, '/api/auth/login', browserToken, { email, password }).expect(200)).body.csrfToken;
    await post(browser, '/api/users/me/change-email', browserToken, { newEmail: 'stale-confirm-new@example.com', currentPassword: password }).expect(202);
    const changeToken = await latestToken('CONFIRM_EMAIL_CHANGE');
    const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: email } });
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id, revokedAt: null }, include: { user: true } });
    const staleAuth = { user: session.user, session, rawToken: 'stale-auth-snapshot' };

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await expect(confirmEmailChange(staleAuth, changeToken, {
      requestId: 'stale-confirm-test', ip: '127.0.0.1', get: () => undefined,
    } as never)).rejects.toMatchObject({ status: 401, code: 'SESSION_INVALID' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailNormalized).toBe(email);
  });

  it('rate-limits sign-out-all password verification before exhausting the hash queue', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'logout-limit@example.com'; const password = 'logout limit password';
    await post(guest, '/api/auth/register', guestToken, { email, password, firstName: 'Logout', lastName: 'Limit' }).expect(202);
    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);
    const browser = supertest.agent(app); let browserToken = await csrf(browser);
    browserToken = (await post(browser, '/api/auth/login', browserToken, { email, password }).expect(200)).body.csrfToken;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await post(browser, '/api/auth/logout-all', browserToken, { currentPassword: 'incorrect logout password' }).expect(401);
    }
    const limited = await post(browser, '/api/auth/logout-all', browserToken, { currentPassword: 'incorrect logout password' }).expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('accepts a Unicode password consistently at registration and login', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const password = '🔐'.repeat(65);
    const email = 'unicode@example.com';
    await post(guest, '/api/auth/register', guestToken, { email, password, firstName: 'Unicode', lastName: 'User' }).expect(202);
    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);

    const browser = supertest.agent(app); const browserToken = await csrf(browser);
    await post(browser, '/api/auth/login', browserToken, { email, password }).expect(200);
  });

  it('clears an invalidated session cookie with idempotent logout', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'stale-session@example.com'; const password = 'stale session password';
    await post(guest, '/api/auth/register', guestToken, { email, password, firstName: 'Stale', lastName: 'Session' }).expect(202);
    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);

    const browser = supertest.agent(app); let browserToken = await csrf(browser);
    const loginResponse = await post(browser, '/api/auth/login', browserToken, { email, password }).expect(200);
    browserToken = loginResponse.body.csrfToken;
    const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: email } });
    await prisma.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
    await browser.get('/api/auth/me').expect(401);

    const logout = await post(browser, '/api/auth/logout', browserToken, {}).expect(204);
    const cookies = Array.isArray(logout.headers['set-cookie']) ? logout.headers['set-cookie'] : [logout.headers['set-cookie']];
    expect(cookies.some((cookie: string) => cookie.startsWith('bt_session=') && /Expires=Thu, 01 Jan 1970/i.test(cookie))).toBe(true);
  });

  it('makes logout idempotent when the request has no cookies or CSRF token', async () => {
    const response = await supertest(app)
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send({})
      .expect(204);
    const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [response.headers['set-cookie']];
    expect(cookies.some((cookie: string) => cookie.startsWith('bt_session='))).toBe(true);
  });

  it('consumes a reset token exactly once under concurrency', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'reset-race@example.com';
    await post(guest, '/api/auth/register', guestToken, { email, password: 'original race password', firstName: 'Reset', lastName: 'Race' }).expect(202);
    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);
    await post(guest, '/api/auth/forgot-password', guestToken, { email }).expect(202);
    const raw = await latestToken('RESET_PASSWORD');

    const outcomes = await Promise.all([
      post(guest, '/api/auth/reset-password', guestToken, { token: raw, password: 'replacement password one', confirmPassword: 'replacement password one' }),
      post(guest, '/api/auth/reset-password', guestToken, { token: raw, password: 'replacement password two', confirmPassword: 'replacement password two' }),
    ]);
    expect(outcomes.map((result) => result.status).sort()).toEqual([200, 400]);
    expect(await prisma.passwordResetToken.count({ where: { user: { emailNormalized: email }, usedAt: null } })).toBe(0);
  });

  it('serializes concurrent resend and forgot requests to one live token', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'token-race@example.com';
    await post(guest, '/api/auth/register', guestToken, { email, password: 'token race password', firstName: 'Token', lastName: 'Race' }).expect(202);
    const user = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: email } });
    await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 2 * 60_000) } });
    await Promise.all([
      post(guest, '/api/auth/resend-verification', guestToken, { email }).expect(202),
      post(guest, '/api/auth/resend-verification', guestToken, { email }).expect(202),
    ]);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } } })).toBe(1);

    await post(guest, '/api/auth/verify-email', guestToken, { token: await latestToken('VERIFY_EMAIL') }).expect(200);
    await Promise.all([
      post(guest, '/api/auth/forgot-password', guestToken, { email }).expect(202),
      post(guest, '/api/auth/forgot-password', guestToken, { email }).expect(202),
    ]);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } } })).toBe(1);
  });

  it('does not deliver mail to an actively suppressed recipient', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    const email = 'suppressed@example.com';
    await post(guest, '/api/auth/register', guestToken, { email, password: 'suppressed mail password', firstName: 'No', lastName: 'Mail' }).expect(202);
    const encryptedRecipient = encryptPii(email);
    await prisma.emailSuppression.create({
      data: {
        recipientLookupHmac: suppressionLookup(email),
        encryptedRecipient: encryptedRecipient.ciphertext,
        keyVersion: encryptedRecipient.keyVersion,
        reason: 'HARD_BOUNCE',
        source: 'TEST',
        providerEventId: 'test-suppression-1',
      },
    });

    expect(await processOutboxBatch()).toBe(1);
    const blocked = await prisma.emailOutbox.findFirstOrThrow();
    expect(blocked).toMatchObject({ status: 'DEAD', encryptedPayload: null, lastErrorCode: 'EMAIL_SUPPRESSED' });
  });

  it('claims an outbox item once when two workers compete', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    await post(guest, '/api/auth/register', guestToken, { email: 'worker-race@example.com', password: 'worker race password', firstName: 'Worker', lastName: 'Race' }).expect(202);
    const processed = await Promise.all([processOutboxBatch(), processOutboxBatch()]);
    expect(processed.sort()).toEqual([0, 1]);
    expect(await prisma.emailOutbox.count({ where: { status: 'SENT' } })).toBe(1);
  });

  it('dead-letters missing, unknown-key and repeatedly stale outbox records', async () => {
    const base = { eventType: 'VERIFY_EMAIL', recipient: 'broken@example.com', nextAttemptAt: new Date() };
    const missing = await prisma.emailOutbox.create({ data: { ...base, dedupeKey: 'broken:missing', encryptedPayload: null, keyVersion: 'v1' } });
    await processOutboxBatch();
    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: missing.id } })).toMatchObject({ status: 'DEAD', lastErrorCode: 'OUTBOX_PAYLOAD_MISSING' });

    const unknown = await prisma.emailOutbox.create({ data: { ...base, dedupeKey: 'broken:key', encryptedPayload: 'not-valid', keyVersion: 'retired' } });
    await processOutboxBatch();
    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: unknown.id } })).toMatchObject({ status: 'DEAD', attemptCount: 1, encryptedPayload: null, lastErrorCode: 'OUTBOX_KEY_VERSION_UNKNOWN' });

    const stale = await prisma.emailOutbox.create({
      data: {
        ...base,
        dedupeKey: 'broken:stale',
        encryptedPayload: 'not-valid',
        keyVersion: 'v1',
        status: 'PROCESSING',
        attemptCount: 4,
        claimId: crypto.randomUUID(),
        lockedAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    await processOutboxBatch();
    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: stale.id } })).toMatchObject({ status: 'DEAD', attemptCount: 5, encryptedPayload: null, lastErrorCode: 'STALE_LOCK_RECOVERED' });
  });

  it('backs off transient provider failures without losing the encrypted payload', async () => {
    const guest = supertest.agent(app); const guestToken = await csrf(guest);
    await post(guest, '/api/auth/register', guestToken, { email: 'retry@example.com', password: 'provider retry password', firstName: 'Retry', lastName: 'Mail' }).expect(202);
    const send = vi.spyOn(emailProvider, 'send').mockRejectedValueOnce(new Error('SMTP_TEMPORARY'));
    try {
      await processOutboxBatch();
    } finally {
      send.mockRestore();
    }
    const retry = await prisma.emailOutbox.findFirstOrThrow();
    expect(retry.status).toBe('PENDING');
    expect(retry.attemptCount).toBe(1);
    expect(retry.encryptedPayload).toBeTruthy();
    expect(retry.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});
