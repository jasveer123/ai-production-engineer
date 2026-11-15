export interface RawSpan {
  spanId: string;
  parentSpanId: string | null;
  start: Date;
  durationMs: number;
}

export interface Placed<T> {
  span: T;
  depth: number;
  offsetMs: number;
  orphan: boolean;
}

export interface Waterfall<T> {
  rows: Placed<T>[];
  start: Date | null;
  durationMs: number;
  missingRoot: boolean;
  orphanCount: number;
}

export function buildWaterfall<T extends RawSpan>(input: T[]): Waterfall<T> {
  const byId = new Map<string, T>();
  for (const s of input) if (!byId.has(s.spanId)) byId.set(s.spanId, s);
  const spans = [...byId.values()];
  if (!spans.length)
    return { rows: [], start: null, durationMs: 0, missingRoot: true, orphanCount: 0 };

  const children = new Map<string, T[]>();
  const tops: T[] = [];
  for (const s of spans) {
    const parent = s.parentSpanId && s.parentSpanId !== s.spanId ? byId.get(s.parentSpanId) : null;
    if (parent) children.set(parent.spanId, [...(children.get(parent.spanId) ?? []), s]);
    else tops.push(s);
  }
  const byStart = (a: T, b: T) => a.start.getTime() - b.start.getTime();
  const start = new Date(Math.min(...spans.map((s) => s.start.getTime())));
  const end = Math.max(...spans.map((s) => s.start.getTime() + s.durationMs));

  const rows: Placed<T>[] = [];
  const seen = new Set<string>();
  const visit = (s: T, depth: number, orphan: boolean) => {
    if (seen.has(s.spanId)) return;
    seen.add(s.spanId);
    rows.push({ span: s, depth, offsetMs: s.start.getTime() - start.getTime(), orphan });
    for (const c of (children.get(s.spanId) ?? []).sort(byStart)) visit(c, depth + 1, false);
  };
  for (const s of tops.sort(byStart)) visit(s, 0, Boolean(s.parentSpanId));
  for (const s of spans.sort(byStart)) visit(s, 0, true);

  return {
    rows,
    start,
    durationMs: end - start.getTime(),
    missingRoot: !spans.some((s) => !s.parentSpanId),
    orphanCount: rows.filter((r) => r.orphan).length,
  };
}
