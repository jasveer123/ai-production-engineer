import { createVerify, generateKeyPairSync } from 'node:crypto';
import { appJwt } from './github-app';

describe('appJwt', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

  it('produces an RS256 JWT GitHub can verify, backdated for clock drift and under 10 minutes', () => {
    const token = appJwt('5372576', pem, 1_800_000_000);
    const [h, p, sig] = token.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toEqual({
      iat: 1_800_000_000 - 60,
      exp: 1_800_000_000 + 540,
      iss: '5372576',
    });
    const ok = createVerify('RSA-SHA256')
      .update(`${h}.${p}`)
      .verify(publicKey, Buffer.from(sig!, 'base64url'));
    expect(ok).toBe(true);
  });
});
