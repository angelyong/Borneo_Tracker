import argon2 from 'argon2';

const options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

const MAX_ACTIVE = 4;
const MAX_QUEUED = 64;
let active = 0;
const queue: Array<() => void> = [];

const acquire = async () => {
  if (active < MAX_ACTIVE) { active += 1; return; }
  if (queue.length >= MAX_QUEUED) {
    const error = new Error('Password hashing capacity is temporarily exhausted.');
    error.name = 'PasswordHashBusyError';
    throw error;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
};
const release = () => {
  const next = queue.shift();
  if (next) next(); else active -= 1;
};
const withCapacity = async <T>(operation: () => Promise<T>) => {
  await acquire();
  try { return await operation(); } finally { release(); }
};

export const hashPassword = (password: string) => withCapacity(() => argon2.hash(password, options));
export const verifyPassword = (hash: string, password: string) => withCapacity(() => argon2.verify(hash, password));
export const needsPasswordRehash = (hash: string) => argon2.needsRehash(hash, options);
export const dummyPasswordHash = hashPassword('not-a-real-user-password-value');
