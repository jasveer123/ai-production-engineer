/**
 * A small protobuf reader for the four OTLP export requests. It turns protobuf into the same
 * shape as OTLP/JSON (ids as hex, 64-bit times as decimal strings), so one code path handles
 * both encodings. Unknown fields are skipped, as protobuf requires.
 */

class Reader {
  pos = 0;
  constructor(
    readonly buf: Uint8Array,
    readonly end = buf.length,
  ) {}

  done(): boolean {
    return this.pos >= this.end;
  }

  varint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (this.pos >= this.end) throw new Error('truncated varint');
      const b = this.buf[this.pos++]!;
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
      shift += 7n;
      if (shift > 70n) throw new Error('varint too long');
    }
  }

  tag(): { field: number; wire: number } {
    const t = Number(this.varint());
    return { field: t >>> 3, wire: t & 7 };
  }

  bytes(): Uint8Array {
    const len = Number(this.varint());
    if (len < 0 || this.pos + len > this.end) throw new Error('truncated bytes');
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  sub(): Reader {
    const len = Number(this.varint());
    if (len < 0 || this.pos + len > this.end) throw new Error('truncated message');
    const r = new Reader(this.buf, this.pos + len);
    r.pos = this.pos;
    this.pos += len;
    return r;
  }

  fixed64(): bigint {
    if (this.pos + 8 > this.end) throw new Error('truncated fixed64');
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getBigUint64(
      0,
      true,
    );
    this.pos += 8;
    return v;
  }

  double(): number {
    if (this.pos + 8 > this.end) throw new Error('truncated double');
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getFloat64(0, true);
    this.pos += 8;
    return v;
  }

  fixed32(): number {
    if (this.pos + 4 > this.end) throw new Error('truncated fixed32');
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getUint32(0, true);
    this.pos += 4;
    return v;
  }

  string(): string {
    return new TextDecoder().decode(this.bytes());
  }

  skip(wire: number): void {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.bytes();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`unsupported wire type ${wire}`);
    if (this.pos > this.end) throw new Error('truncated field');
  }
}

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/** Decodes `fields` of a message: each handler reads its own value. Others are skipped. */
function message<T extends object>(
  r: Reader,
  init: T,
  handlers: Record<number, (r: Reader, out: T, wire: number) => void>,
): T {
  while (!r.done()) {
    const { field, wire } = r.tag();
    const h = handlers[field];
    if (h) h(r, init, wire);
    else r.skip(wire);
  }
  return init;
}

type Json = Record<string, unknown>;
const push = (out: Json, key: string, v: unknown) => {
  ((out[key] ??= []) as unknown[]).push(v);
};

function anyValue(r: Reader): Json {
  return message<Json>(
    r,
    {},
    {
      1: (r, o) => (o.stringValue = r.string()),
      2: (r, o) => (o.boolValue = r.varint() !== 0n),
      3: (r, o) => (o.intValue = BigInt.asIntN(64, r.varint()).toString()),
      4: (r, o) => (o.doubleValue = r.double()),
      5: (r, o) =>
        (o.arrayValue = message<Json>(
          r.sub(),
          { values: [] },
          { 1: (r, a) => push(a, 'values', anyValue(r.sub())) },
        )),
      6: (r, o) =>
        (o.kvlistValue = message<Json>(
          r.sub(),
          { values: [] },
          { 1: (r, a) => push(a, 'values', keyValue(r.sub())) },
        )),
      7: (r, o) => (o.bytesValue = Buffer.from(r.bytes()).toString('base64')),
    },
  );
}

function keyValue(r: Reader): Json {
  return message<Json>(
    r,
    {},
    {
      1: (r, o) => (o.key = r.string()),
      2: (r, o) => (o.value = anyValue(r.sub())),
    },
  );
}

const attrs = (r: Reader, o: Json) => push(o, 'attributes', keyValue(r.sub()));

function resource(r: Reader): Json {
  return message<Json>(r, { attributes: [] }, { 1: attrs });
}

function scope(r: Reader): Json {
  return message<Json>(
    r,
    { attributes: [] },
    {
      1: (r, o) => (o.name = r.string()),
      2: (r, o) => (o.version = r.string()),
      3: attrs,
    },
  );
}

function span(r: Reader): Json {
  return message<Json>(
    r,
    { attributes: [], events: [] },
    {
      1: (r, o) => (o.traceId = hex(r.bytes())),
      2: (r, o) => (o.spanId = hex(r.bytes())),
      3: (r, o) => (o.traceState = r.string()),
      4: (r, o) => (o.parentSpanId = hex(r.bytes())),
      5: (r, o) => (o.name = r.string()),
      6: (r, o) => (o.kind = Number(r.varint())),
      7: (r, o) => (o.startTimeUnixNano = r.fixed64().toString()),
      8: (r, o) => (o.endTimeUnixNano = r.fixed64().toString()),
      9: attrs,
      11: (r, o) =>
        push(
          o,
          'events',
          message<Json>(
            r.sub(),
            { attributes: [] },
            {
              1: (r, e) => (e.timeUnixNano = r.fixed64().toString()),
              2: (r, e) => (e.name = r.string()),
              3: attrs,
            },
          ),
        ),
      15: (r, o) =>
        (o.status = message<Json>(
          r.sub(),
          {},
          {
            2: (r, s) => (s.message = r.string()),
            3: (r, s) => (s.code = Number(r.varint())),
          },
        )),
    },
  );
}

function logRecord(r: Reader): Json {
  return message<Json>(
    r,
    { attributes: [] },
    {
      1: (r, o) => (o.timeUnixNano = r.fixed64().toString()),
      2: (r, o) => (o.severityNumber = Number(r.varint())),
      3: (r, o) => (o.severityText = r.string()),
      5: (r, o) => (o.body = anyValue(r.sub())),
      6: attrs,
      8: (r, o) => (o.flags = r.fixed32()),
      9: (r, o) => (o.traceId = hex(r.bytes())),
      10: (r, o) => (o.spanId = hex(r.bytes())),
      11: (r, o) => (o.observedTimeUnixNano = r.fixed64().toString()),
      12: (r, o) => (o.eventName = r.string()),
    },
  );
}

/** Counts data points per metric without keeping them (metrics are acknowledged, not stored). */
function metric(r: Reader): Json {
  return message<Json>(r, {}, { 1: (r, o) => (o.name = r.string()) });
}

function resourceGroup(
  r: Reader,
  scopeKey: string,
  itemKey: string,
  item: (r: Reader) => Json,
  itemField = 2,
): Json {
  return message<Json>(
    r,
    { [scopeKey]: [] },
    {
      1: (r, o) => (o.resource = resource(r.sub())),
      2: (r, o) =>
        push(
          o,
          scopeKey,
          message<Json>(
            r.sub(),
            { [itemKey]: [] },
            {
              1: (r, s) => (s.scope = scope(r.sub())),
              [itemField]: (r, s) => push(s, itemKey, item(r.sub())),
            },
          ),
        ),
    },
  );
}

export function decodeTraces(buf: Uint8Array): Json {
  return message<Json>(
    new Reader(buf),
    { resourceSpans: [] },
    {
      1: (r, o) => push(o, 'resourceSpans', resourceGroup(r.sub(), 'scopeSpans', 'spans', span)),
    },
  );
}

export function decodeLogs(buf: Uint8Array): Json {
  return message<Json>(
    new Reader(buf),
    { resourceLogs: [] },
    {
      1: (r, o) =>
        push(o, 'resourceLogs', resourceGroup(r.sub(), 'scopeLogs', 'logRecords', logRecord)),
    },
  );
}

export function decodeMetrics(buf: Uint8Array): Json {
  return message<Json>(
    new Reader(buf),
    { resourceMetrics: [] },
    {
      1: (r, o) =>
        push(o, 'resourceMetrics', resourceGroup(r.sub(), 'scopeMetrics', 'metrics', metric)),
    },
  );
}

// ---------- Encoder (tests and the SDK fixtures only need a tiny writer) ----------

export class Writer {
  private chunks: number[] = [];

  private varintRaw(v: bigint): void {
    let x = BigInt.asUintN(64, v);
    while (x > 0x7fn) {
      this.chunks.push(Number((x & 0x7fn) | 0x80n));
      x >>= 7n;
    }
    this.chunks.push(Number(x));
  }
  private tag(field: number, wire: number) {
    this.varintRaw(BigInt((field << 3) | wire));
  }
  uint(field: number, v: number | bigint): this {
    this.tag(field, 0);
    this.varintRaw(BigInt(v));
    return this;
  }
  fixed64(field: number, v: bigint): this {
    this.tag(field, 1);
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(v);
    this.chunks.push(...b);
    return this;
  }
  bytes(field: number, v: Uint8Array): this {
    this.tag(field, 2);
    this.varintRaw(BigInt(v.length));
    this.chunks.push(...v);
    return this;
  }
  string(field: number, v: string): this {
    return this.bytes(field, Buffer.from(v, 'utf8'));
  }
  message(field: number, w: Writer): this {
    return this.bytes(field, w.finish());
  }
  finish(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}
