const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, c } = require('./helpers.cjs');

const longToken = 't'.repeat(20);
const pw = 'x'.repeat(10);

test('registerSchema normalises email and enforces password length', () => {
  const r = parse(c.registerSchema, { name: ' Ada ', email: ' ADA@Example.com ', password: pw });
  assert.equal(r.email, 'ada@example.com');
  assert.equal(r.name, 'Ada');
  bad(c.registerSchema, { name: 'Ada', email: 'ada@example.com', password: 'short' });
  bad(c.registerSchema, { name: 'Ada', email: 'not-an-email', password: pw });
  bad(c.registerSchema, { name: '', email: 'ada@example.com', password: pw });
  ok(c.registerSchema, { name: 'Ada', email: 'a@b.co', password: pw, inviteToken: longToken });
  bad(c.registerSchema, { name: 'Ada', email: 'a@b.co', password: pw, inviteToken: 'short' });
});

test('loginSchema requires a password but not the minimum length', () => {
  ok(c.loginSchema, { email: 'a@b.co', password: 'x' });
  bad(c.loginSchema, { email: 'a@b.co', password: '' });
  bad(c.loginSchema, { email: 'a@b.co', password: 'x'.repeat(c.PASSWORD_MAX + 1) });
});

test('devLoginSchema, forgotPasswordSchema', () => {
  ok(c.devLoginSchema, { email: 'a@b.co' });
  bad(c.devLoginSchema, { email: 'a' });
  ok(c.forgotPasswordSchema, { email: 'A@B.co' });
  bad(c.forgotPasswordSchema, {});
});

test('resetPasswordSchema and tokenSchema need a long token', () => {
  ok(c.resetPasswordSchema, { token: longToken, password: pw });
  bad(c.resetPasswordSchema, { token: 'short', password: pw });
  bad(c.resetPasswordSchema, { token: longToken, password: 'short' });
  ok(c.tokenSchema, { token: longToken });
  bad(c.tokenSchema, { token: 'short' });
});

test('changePasswordSchema: current password optional, new one bounded', () => {
  ok(c.changePasswordSchema, { newPassword: pw });
  ok(c.changePasswordSchema, { currentPassword: 'old', newPassword: pw });
  bad(c.changePasswordSchema, { newPassword: 'short' });
});

test('updateProfileSchema trims and requires a name', () => {
  assert.equal(parse(c.updateProfileSchema, { name: ' Ada ' }).name, 'Ada');
  bad(c.updateProfileSchema, { name: ' ' });
  bad(c.updateProfileSchema, { name: 'x'.repeat(101) });
});
