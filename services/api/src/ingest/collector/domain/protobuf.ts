export class Reader {
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

export function message<T extends object>(
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

const zigzag = (v: bigint) => Number((v >> 1n) ^ -(v & 1n));
const ns = (r: Reader) => r.fixed64().toString();

function repeated(r: Reader, wire: number, read: (r: Reader) => number): number[] {
  if (wire !== 2) return [read(r)];
  const sub = r.sub();
  const out: number[] = [];
  while (!sub.done()) out.push(read(sub));
  return out;
}

const pushAll = (out: Json, key: string, values: number[]) => {
  ((out[key] ??= []) as number[]).push(...values);
};

function numberPoint(r: Reader): Json {
  return message<Json>(
    r,
    { attributes: [] },
    {
      7: attrs,
      2: (r, o) => (o.startTimeUnixNano = ns(r)),
      3: (r, o) => (o.timeUnixNano = ns(r)),
      4: (r, o) => (o.asDouble = r.double()),
      6: (r, o) => (o.asInt = BigInt.asIntN(64, r.fixed64()).toString()),
    },
  );
}

function histogramPoint(r: Reader): Json {
  return message<Json>(
    r,
    { attributes: [] },
    {
      9: attrs,
      2: (r, o) => (o.startTimeUnixNano = ns(r)),
      3: (r, o) => (o.timeUnixNano = ns(r)),
      4: (r, o) => (o.count = ns(r)),
      5: (r, o) => (o.sum = r.double()),
      6: (r, o, w) =>
        pushAll(
          o,
          'bucketCounts',
          repeated(r, w, (x) => Number(x.fixed64())),
        ),
      7: (r, o, w) =>
        pushAll(
          o,
          'explicitBounds',
          repeated(r, w, (x) => x.double()),
        ),
      11: (r, o) => (o.min = r.double()),
      12: (r, o) => (o.max = r.double()),
    },
  );
}

function expBuckets(r: Reader): Json {
  return message<Json>(
    r,
    { bucketCounts: [] },
    {
      1: (r, o) => (o.offset = zigzag(r.varint())),
      2: (r, o, w) =>
        pushAll(
          o,
          'bucketCounts',
          repeated(r, w, (x) => Number(x.varint())),
        ),
    },
  );
}

function expHistogramPoint(r: Reader): Json {
  return message<Json>(
    r,
    { attributes: [] },
    {
      1: attrs,
      2: (r, o) => (o.startTimeUnixNano = ns(r)),
      3: (r, o) => (o.timeUnixNano = ns(r)),
      4: (r, o) => (o.count = ns(r)),
      5: (r, o) => (o.sum = r.double()),
      6: (r, o) => (o.scale = zigzag(r.varint())),
      7: (r, o) => (o.zeroCount = ns(r)),
      8: (r, o) => (o.positive = expBuckets(r.sub())),
      9: (r, o) => (o.negative = expBuckets(r.sub())),
      12: (r, o) => (o.min = r.double()),
      13: (r, o) => (o.max = r.double()),
    },
  );
}

function metric(r: Reader): Json {
  const points = (point: (r: Reader) => Json) => (r: Reader) =>
    message<Json>(
      r.sub(),
      { dataPoints: [] },
      {
        1: (r, o) => push(o, 'dataPoints', point(r.sub())),
        2: (r, o) => (o.aggregationTemporality = Number(r.varint())),
        3: (r, o) => (o.isMonotonic = r.varint() !== 0n),
      },
    );
  const skipped = (r: Reader) => {
    r.pos = r.end;
    return {};
  };
  return message<Json>(
    r,
    {},
    {
      1: (r, o) => (o.name = r.string()),
      3: (r, o) => (o.unit = r.string()),
      5: (r, o) => (o.gauge = points(numberPoint)(r)),
      7: (r, o) => (o.sum = points(numberPoint)(r)),
      9: (r, o) => (o.histogram = points(histogramPoint)(r)),
      10: (r, o) => (o.exponentialHistogram = points(expHistogramPoint)(r)),
      11: (r, o) => (o.summary = points(skipped)(r)),
    },
  );
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

export { Writer } from './protobuf-writer';
