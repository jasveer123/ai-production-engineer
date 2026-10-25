import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with scrypt (memory-hard, built into Node). The parameters are stored with the
 * hash so they can be raised later without breaking existing accounts.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
// scrypt needs 128 * N * r bytes; give it headroom over Node's 32 MB default.
const MAX_MEM = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(
      password.normalize('NFKC'),
      salt,
      KEY_LEN,
      { N: n, r, p, maxmem: MAX_MEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), +n, +r, +p);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A hash to compare against when the account does not exist, so timing does not reveal it. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

/** Random URL-safe token for links; only its hash is stored. */
export function newLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// The most common passwords that pass the length rule (subset of public breach lists).
const COMMON = new Set([
  '1234567890',
  '12345678910',
  '0123456789',
  '1111111111',
  '0000000000',
  'qwertyuiop',
  'password123',
  'password1234',
  'password12345',
  'passw0rd123',
  'iloveyou123',
  'qwerty12345',
  'qwerty123456',
  '1q2w3e4r5t',
  '1qaz2wsx3edc',
  'abcdefghij',
  'abc1234567',
  'welcome123',
  'letmein123',
  'administrator',
  'changeme123',
  'football123',
  'sunshine123',
  'princess123',
  'whatever123',
  'aaaaaaaaaa',
]);

/** Returns a reason when the password is too weak, otherwise null. */
export function weakPasswordReason(password: string, email: string): string | null {
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'This password is too common. Choose another one.';
  if (new Set(lower).size < 4) return 'Use more different characters.';
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && lower.includes(local)) return 'Do not use your email in the password.';
  return null;
}
