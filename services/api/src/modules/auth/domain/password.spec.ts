import { hashPassword, sha256, verifyPassword, weakPasswordReason } from './password';
import { RateLimiter } from '../rate-limit';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('correct horse batterY', hash)).resolves.toBe(false);
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('flags common, repetitive and email-based passwords', () => {
    expect(weakPasswordReason('Password123', 'a@b.c')).toMatch(/common/);
    expect(weakPasswordReason('aaaaabbbbb', 'a@b.c')).toMatch(/different/);
    expect(weakPasswordReason('jasveer-2026!', 'jasveer@shop.io')).toMatch(/email/);
    expect(weakPasswordReason('tidy-otter-lamp', 'a@b.c')).toBeNull();
  });

  it('hashes tokens deterministically', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).toHaveLength(64);
  });
});

describe('RateLimiter', () => {
  it('allows the limit then throws until the window resets', () => {
    const rl = new RateLimiter(2, 1000);
    rl.check('ip', 0);
    rl.check('ip', 10);
    expect(() => rl.check('ip', 20)).toThrow(/Too many/);
    expect(() => rl.check('other', 20)).not.toThrow();
    expect(() => rl.check('ip', 1001)).not.toThrow();
  });
});
