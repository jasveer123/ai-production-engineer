// Matches the notifications delivery log: phones keep the last 4 digits, e-mails the first
// character and the domain, URLs only their host.
export function maskAddress(channel: string, address: string): string {
  if (address.includes('@')) {
    const [local, domain] = address.split('@');
    return `${local?.charAt(0) ?? ''}•••@${domain ?? ''}`;
  }
  if (
    channel === 'sms' ||
    channel === 'call' ||
    channel === 'phone' ||
    /^\+?\d[\d\s-]{5,}$/.test(address)
  ) {
    const digits = address.replace(/\D/g, '');
    return digits.length > 4 ? `•••${digits.slice(-4)}` : '•••';
  }
  try {
    return new URL(address).host;
  } catch {
    return address;
  }
}
