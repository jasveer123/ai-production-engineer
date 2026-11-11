export function snappyDecode(input: Uint8Array, maxBytes = 64 * 1024 * 1024): Buffer {
  let pos = 0;
  let length = 0;
  for (let shift = 0; ; shift += 7) {
    const b = input[pos++];
    if (b === undefined || shift > 28) throw new Error('bad snappy header');
    length |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
  }
  if (length < 0 || length > maxBytes) throw new Error('snappy payload too large');
  const out = Buffer.alloc(length);
  let o = 0;
  while (pos < input.length) {
    const tag = input[pos++]!;
    const kind = tag & 3;
    if (kind === 0) {
      let len = tag >> 2;
      if (len >= 60) {
        const extra = len - 59;
        len = 0;
        for (let i = 0; i < extra; i++) len |= (input[pos++] ?? 0) << (8 * i);
      }
      len += 1;
      if (pos + len > input.length || o + len > length) throw new Error('bad snappy literal');
      out.set(input.subarray(pos, pos + len), o);
      pos += len;
      o += len;
      continue;
    }
    let len: number;
    let offset: number;
    if (kind === 1) {
      len = 4 + ((tag >> 2) & 7);
      offset = ((tag >> 5) << 8) | (input[pos++] ?? 0);
    } else if (kind === 2) {
      len = 1 + (tag >> 2);
      offset = (input[pos] ?? 0) | ((input[pos + 1] ?? 0) << 8);
      pos += 2;
    } else {
      len = 1 + (tag >> 2);
      offset =
        (input[pos] ?? 0) |
        ((input[pos + 1] ?? 0) << 8) |
        ((input[pos + 2] ?? 0) << 16) |
        ((input[pos + 3] ?? 0) << 24);
      pos += 4;
    }
    if (offset <= 0 || offset > o || o + len > length) throw new Error('bad snappy copy');
    for (let i = 0; i < len; i++) out[o + i] = out[o - offset + i]!;
    o += len;
  }
  if (o !== length) throw new Error('snappy length mismatch');
  return out;
}
