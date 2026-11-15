import { maskAddress } from './mask';

describe('maskAddress', () => {
  it('keeps only the last 4 digits of a phone', () => {
    expect(maskAddress('sms', '+91 98765 43210')).toBe('•••3210');
    expect(maskAddress('call', '+14155550123')).toBe('•••0123');
  });

  it('keeps the first character and domain of an e-mail', () => {
    expect(maskAddress('email', 'oncall@example.com')).toBe('o•••@example.com');
  });

  it('shows only the host of a webhook', () => {
    expect(maskAddress('webhook', 'https://hooks.example.com/secret/path')).toBe(
      'hooks.example.com',
    );
  });
});
