import { redact } from './redact';

describe('redact', () => {
  it.each([
    ['token ghp_abcdefghijklmnopqrstuvwxyz0123', 'github_token'],
    ['key sk-ant-api03-abcdefghijklmnopqrstuv', 'anthropic_key'],
    ['AKIAABCDEFGHIJKLMNOP', 'aws_key'],
    ['Authorization: Bearer abc.def-ghi_jkl123456', 'bearer'],
    ['postgres://shop:hunter2@db:5432/shop', 'url_credentials'],
    ['password=hunter22', 'assignment'],
    ['contact jane.doe@example.com', 'email'],
    ['card 4242 4242 4242 4242', 'card_number'],
    [
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      'jwt',
    ],
  ])('redacts %s', (input, kind) => {
    const r = redact(input);
    expect(r.counts[kind]).toBe(1);
    expect(r.text).toContain('[REDACTED');
  });

  it('keeps the readable parts around a secret', () => {
    expect(redact('API_KEY = "abcd1234efgh"').text).toBe('API_KEY = [REDACTED:secret]');
    expect(redact('postgres://shop:pw@db/shop').text).toBe(
      'postgres://[REDACTED:credentials]@db/shop',
    );
  });

  it('leaves ordinary code and stack traces alone', () => {
    const code =
      "const promo = this.promotions.get(code ?? '') as Coupon;\n    at CheckoutService.discountV2 (/app/api/src/services/checkout.ts:81:46)";
    expect(redact(code)).toEqual({ text: code, counts: {} });
  });
});
