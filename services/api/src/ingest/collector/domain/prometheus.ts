import { seriesKeyOf } from './otlp-metrics';
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_SERVICE,
  emptyBatch,
  reject,
  type Batch,
  type MetricPointInput,
} from './types';
import { message, Reader } from './protobuf';

interface Series {
  labels: Record<string, string>;
  samples: { value: number; ts: number }[];
}

const MAX_POINTS = 5000;
const SERVICE_LABELS = ['service', 'service_name', 'job', 'app'];
const ENV_LABELS = ['environment', 'env', 'deployment_environment'];

function series(r: Reader): Series {
  const out: Series = { labels: {}, samples: [] };
  return message<Series>(r, out, {
    1: (r, o) => {
      const label = message<{ name: string; value: string }>(
        r.sub(),
        { name: '', value: '' },
        { 1: (r, l) => (l.name = r.string()), 2: (r, l) => (l.value = r.string()) },
      );
      if (label.name) o.labels[label.name] = label.value;
    },
    2: (r, o) =>
      o.samples.push(
        message<{ value: number; ts: number }>(
          r.sub(),
          { value: Number.NaN, ts: Date.now() },
          {
            1: (r, s) => (s.value = r.double()),
            2: (r, s) => (s.ts = Number(BigInt.asIntN(64, r.varint()))),
          },
        ),
      ),
  });
}

const firstOf = (labels: Record<string, string>, keys: string[]) =>
  keys.map((k) => labels[k]).find((v): v is string => Boolean(v));

const guessKind = (name: string): MetricPointInput['kind'] =>
  /_(total|count|sum|bucket)$/.test(name) ? 'counter' : 'gauge';

function addSeries(batch: Batch, s: Series, kindOf: (name: string) => MetricPointInput['kind']) {
  batch.received += s.samples.length;
  const name = s.labels.__name__;
  if (!name) return reject(batch, 'invalid_metric: series has no __name__', s.samples.length);
  const attributes = Object.fromEntries(
    Object.entries(s.labels)
      .filter(([k]) => k !== '__name__')
      .slice(0, 20),
  );
  const base = {
    service: (firstOf(s.labels, SERVICE_LABELS) ?? DEFAULT_SERVICE).slice(0, 100),
    environment: (firstOf(s.labels, ENV_LABELS) ?? DEFAULT_ENVIRONMENT).slice(0, 40),
    name: name.slice(0, 200),
    kind: kindOf(name),
    unit: null,
    attributes,
    seriesKey: seriesKeyOf({ resource: {}, scope: null, name, attributes }),
  };
  const counter = base.kind === 'counter';
  for (const sample of s.samples) {
    if (!Number.isFinite(sample.value)) {
      reject(batch, `invalid_point: "${name}" has a non-finite sample`);
      continue;
    }
    if (batch.points.length >= MAX_POINTS) {
      reject(batch, `limit_exceeded: at most ${MAX_POINTS} samples per request`);
      continue;
    }
    batch.points.push({
      ...base,
      ts: new Date(sample.ts),
      value: sample.value,
      temporality: counter ? 'cumulative' : null,
      monotonic: counter ? true : null,
    });
  }
}

export function prometheusToBatch(buf: Uint8Array): Batch {
  const all: Series[] = [];
  message<object>(new Reader(buf), {}, { 1: (r) => all.push(series(r.sub())) });
  const batch = emptyBatch('http');
  for (const s of all) addSeries(batch, s, guessKind);
  return batch;
}

const LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)(?:\s+(-?\d+))?\s*$/;
const LABEL = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g;

function parseLabels(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of (raw ?? '').matchAll(LABEL))
    out[m[1]!] = m[2]!.replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
  return out;
}

function parseValue(raw: string): number {
  if (raw === '+Inf') return Number.POSITIVE_INFINITY;
  if (raw === '-Inf') return Number.NEGATIVE_INFINITY;
  return Number(raw);
}

function familyKind(types: Map<string, string>, name: string): MetricPointInput['kind'] {
  const family = name.replace(/_(bucket|sum|count|total)$/, '');
  const type = types.get(name) ?? types.get(family);
  if (type === 'gauge') return 'gauge';
  if (type === 'counter' || type === 'histogram' || type === 'summary') return 'counter';
  return guessKind(name);
}

export function prometheusTextToBatch(text: string, now = Date.now()): Batch {
  const batch = emptyBatch('http');
  const types = new Map<string, string>();
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const type = /^#\s*TYPE\s+(\S+)\s+(\S+)/.exec(line);
    if (type) return void types.set(type[1]!, type[2]!);
    if (line.startsWith('#')) return;
    const m = LINE.exec(line);
    if (!m) {
      batch.received += 1;
      return reject(batch, 'invalid_line', 1, index);
    }
    const labels = { ...parseLabels(m[2]), __name__: m[1]! };
    const ts = m[4] ? Number(m[4]) : now;
    addSeries(batch, { labels, samples: [{ value: parseValue(m[3]!), ts }] }, (name) =>
      familyKind(types, name),
    );
  });
  return batch;
}
