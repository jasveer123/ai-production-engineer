export const MAX_ENVELOPE_ITEMS = 100;
export const MAX_EVENT_BYTES = 1_000_000;

export interface EnvelopeItem {
  type: string;
  headers: Record<string, unknown>;
  payload: Buffer;
}

export interface Envelope {
  header: Record<string, unknown>;
  items: EnvelopeItem[];
}

export class EnvelopeError extends Error {}

const NEWLINE = 0x0a;

function readLine(buf: Buffer, pos: number): [Buffer, number] {
  const end = buf.indexOf(NEWLINE, pos);
  return end < 0 ? [buf.subarray(pos), buf.length] : [buf.subarray(pos, end), end + 1];
}

function parseJsonObject(raw: Buffer, what: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new EnvelopeError(`${what} is not valid JSON`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EnvelopeError(`${what} must be an object`);
  return value as Record<string, unknown>;
}

export function parseEnvelope(buf: Buffer): Envelope {
  const [headLine, afterHead] = readLine(buf, 0);
  const header = parseJsonObject(headLine, 'Envelope header');
  const items: EnvelopeItem[] = [];
  let pos = afterHead;
  while (pos < buf.length) {
    const [line, next] = readLine(buf, pos);
    pos = next;
    if (line.toString('utf8').trim() === '') continue;
    if (items.length >= MAX_ENVELOPE_ITEMS) throw new EnvelopeError('Too many envelope items');
    const headers = parseJsonObject(line, 'Item header');
    const type = typeof headers.type === 'string' ? headers.type : '';
    let payload: Buffer;
    if (typeof headers.length === 'number') {
      const length = headers.length;
      if (!Number.isInteger(length) || length < 0 || pos + length > buf.length)
        throw new EnvelopeError('Item length is out of range');
      payload = buf.subarray(pos, pos + length);
      pos += length;
      if (buf[pos] === NEWLINE) pos += 1;
    } else {
      [payload, pos] = readLine(buf, pos);
    }
    items.push({ type, headers, payload });
  }
  return { header, items };
}

export function eventPayload(item: EnvelopeItem): Record<string, unknown> | null {
  if (item.type !== 'event' || item.payload.length > MAX_EVENT_BYTES) return null;
  return parseJsonObject(item.payload, 'Event');
}

export function parseSentryAuth(header: string | undefined): string | null {
  if (!header) return null;
  const match = /sentry_key=([^,\s]+)/.exec(header);
  return match ? match[1]! : null;
}
