import { DEFAULT_ENVIRONMENT, DEFAULT_SERVICE, type MetricPointInput } from './types';
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

export function prometheusToPoints(buf: Uint8Array): MetricPointInput[] {
  const all: Series[] = [];
  message<object>(new Reader(buf), {}, { 1: (r) => all.push(series(r.sub())) });
  const points: MetricPointInput[] = [];
  for (const s of all) {
    const name = s.labels.__name__;
    if (!name) continue;
    const service = (firstOf(s.labels, SERVICE_LABELS) ?? DEFAULT_SERVICE).slice(0, 100);
    const environment = (firstOf(s.labels, ENV_LABELS) ?? DEFAULT_ENVIRONMENT).slice(0, 40);
    const attributes = Object.fromEntries(
      Object.entries(s.labels)
        .filter(([k]) => k !== '__name__')
        .slice(0, 20),
    );
    const kind = /_(total|count|sum|bucket)$/.test(name) ? 'counter' : 'gauge';
    for (const sample of s.samples) {
      if (!Number.isFinite(sample.value) || points.length >= MAX_POINTS) continue;
      points.push({
        ts: new Date(sample.ts),
        service,
        environment,
        name: name.slice(0, 200),
        kind,
        unit: null,
        value: sample.value,
        attributes,
      });
    }
  }
  return points;
}
