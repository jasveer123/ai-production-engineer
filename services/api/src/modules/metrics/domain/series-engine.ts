import type { MetricAgg } from '@ape/api-contracts';
import type { MetricHistogram } from '../../../core/db/schema';
import {
  histogramQuantile,
  merge,
  sampleOf,
  sampleQuantile,
  subtract,
  type HistogramSample,
} from './histogram';

export interface PointRow {
  ts: Date;
  seriesKey: string;
  group: string;
  kind: string;
  temporality: string | null;
  monotonic: boolean | null;
  startTs: Date | null;
  value: number;
  histogram: MetricHistogram | null;
}

export interface Grid {
  from: number;
  bucketMs: number;
  buckets: number;
}

const QUANTILES: Partial<Record<MetricAgg, number>> = { p50: 0.5, p90: 0.9, p95: 0.95, p99: 0.99 };

interface Cell {
  values: number[];
  increase: number | null;
  hist: HistogramSample | null;
}

const emptyCell = (): Cell => ({ values: [], increase: null, hist: null });

function bucketIndex(grid: Grid, ts: Date): number | null {
  const offset = ts.getTime() - grid.from;
  if (offset < 0) return null;
  return Math.min(grid.buckets - 1, Math.floor(offset / grid.bucketMs));
}

const isCumulative = (p: PointRow) =>
  p.temporality === 'cumulative' || (p.temporality === null && p.kind === 'counter');
const isDelta = (p: PointRow) => p.temporality === 'delta';
const isReset = (cur: PointRow, prev: PointRow) =>
  cur.startTs !== null && prev.startTs !== null && cur.startTs.getTime() !== prev.startTs.getTime();

function scalarIncrement(cur: PointRow, prev: PointRow | null, grid: Grid): number | null {
  if (isDelta(cur)) return cur.value;
  if (!prev) return cur.startTs && cur.startTs.getTime() >= grid.from ? cur.value : null;
  const monotonic = cur.monotonic ?? cur.kind === 'counter';
  if (monotonic && isCumulative(cur) && (cur.value < prev.value || isReset(cur, prev)))
    return cur.value;
  return cur.value - prev.value;
}

function histogramIncrement(
  cur: PointRow,
  prev: PointRow | null,
  grid: Grid,
): HistogramSample | null {
  const sample = sampleOf(cur.histogram!);
  if (isDelta(cur)) return sample;
  if (!prev?.histogram) return cur.startTs && cur.startTs.getTime() >= grid.from ? sample : null;
  if (isReset(cur, prev)) return sample;
  return subtract(sample, sampleOf(prev.histogram)) ?? sample;
}

function addToCell(cell: Cell, cur: PointRow, prev: PointRow | null, grid: Grid): void {
  if (cur.histogram) {
    const inc = histogramIncrement(cur, prev, grid);
    if (!inc) return;
    cell.hist = cell.hist ? merge(cell.hist, inc) : inc;
    cell.increase = (cell.increase ?? 0) + inc.count;
    return;
  }
  cell.values.push(cur.value);
  const inc = scalarIncrement(cur, prev, grid);
  if (inc !== null) cell.increase = (cell.increase ?? 0) + inc;
}

function cellValue(cell: Cell, agg: MetricAgg, grid: Grid): number | null {
  const q = QUANTILES[agg];
  if (q !== undefined)
    return cell.hist ? histogramQuantile(q, cell.hist.buckets) : sampleQuantile(q, cell.values);
  if (agg === 'increase') return cell.increase;
  if (agg === 'rate') return cell.increase === null ? null : cell.increase / (grid.bucketMs / 1000);
  if (cell.hist) return histogramScalar(cell.hist, agg);
  const v = cell.values;
  if (v.length === 0) return null;
  if (agg === 'count') return v.length;
  if (agg === 'sum') return v.reduce((a, b) => a + b, 0);
  if (agg === 'min') return Math.min(...v);
  if (agg === 'max') return Math.max(...v);
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function histogramScalar(h: HistogramSample, agg: MetricAgg): number | null {
  if (agg === 'count') return h.count;
  if (agg === 'sum') return h.sum;
  if (agg === 'avg') return h.sum === null || h.count === 0 ? null : h.sum / h.count;
  return histogramQuantile(agg === 'min' ? 0 : 1, h.buckets);
}

/** Rows must belong to one metric. Returns one value per bucket per group; null means no data. */
export function aggregateSeries(
  rows: PointRow[],
  grid: Grid,
  agg: MetricAgg,
): Map<string, (number | null)[]> {
  const bySeries = new Map<string, PointRow[]>();
  for (const r of rows) {
    const list = bySeries.get(r.seriesKey) ?? [];
    list.push(r);
    bySeries.set(r.seriesKey, list);
  }
  const cells = new Map<string, Cell[]>();
  for (const series of bySeries.values()) {
    series.sort((a, b) => a.ts.getTime() - b.ts.getTime());
    let prev: PointRow | null = null;
    for (const cur of series) {
      const index = bucketIndex(grid, cur.ts);
      if (index !== null) {
        const groupCells = cells.get(cur.group) ?? Array.from({ length: grid.buckets }, emptyCell);
        cells.set(cur.group, groupCells);
        addToCell(groupCells[index]!, cur, prev, grid);
      }
      prev = cur;
    }
  }
  const out = new Map<string, (number | null)[]>();
  for (const [group, list] of cells)
    out.set(
      group,
      list.map((c) => cellValue(c, agg, grid)),
    );
  return out;
}
