const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

interface Segment {
  col: number;
  source: number;
  line: number;
  origCol: number;
  name: number | null;
}

export interface ParsedMap {
  sources: string[];
  names: string[];
  lines: Segment[][];
}

export function parseSourceMap(text: string): ParsedMap {
  const raw = JSON.parse(text) as { sources?: string[]; names?: string[]; mappings?: string };
  if (!Array.isArray(raw.sources) || typeof raw.mappings !== 'string')
    throw new Error('Not a source map');
  let source = 0;
  let line = 0;
  let origCol = 0;
  let name = 0;
  const lines: Segment[][] = [];
  for (const row of raw.mappings.split(';')) {
    let col = 0;
    const segments: Segment[] = [];
    for (const part of row.split(',')) {
      if (!part) continue;
      const values: number[] = [];
      let shift = 0;
      let value = 0;
      for (const ch of part) {
        const digit = B64.indexOf(ch);
        if (digit < 0) throw new Error('Bad mapping');
        value |= (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
          continue;
        }
        values.push(value & 1 ? -(value >> 1) : value >> 1);
        value = 0;
        shift = 0;
      }
      col += values[0] ?? 0;
      if (values.length < 4) continue;
      source += values[1]!;
      line += values[2]!;
      origCol += values[3]!;
      if (values.length > 4) name += values[4]!;
      segments.push({ col, source, line, origCol, name: values.length > 4 ? name : null });
    }
    lines.push(segments);
  }
  return { sources: raw.sources, names: raw.names ?? [], lines };
}

export function originalPosition(
  map: ParsedMap,
  line: number,
  column: number,
): { source: string; line: number; column: number; name: string | null } | null {
  const segments = map.lines[line - 1];
  if (!segments) return null;
  let best: Segment | null = null;
  for (const s of segments) {
    if (s.col <= column - 1) best = s;
    else break;
  }
  if (!best) return null;
  return {
    source: map.sources[best.source] ?? '?',
    line: best.line + 1,
    column: best.origCol + 1,
    name: best.name === null ? null : (map.names[best.name] ?? null),
  };
}

const FRAME = /^(\s*at\s+)(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;

export function symbolicateFrame(
  frame: string,
  find: (file: string) => ParsedMap | null,
): string | null {
  const m = FRAME.exec(frame);
  if (!m) return null;
  const [, , fn, path, line, col] = m;
  const map = find(path!.split('/').pop()!.split('?')[0]!);
  if (!map) return null;
  const pos = originalPosition(map, Number(line), Number(col));
  if (!pos) return null;
  const name = pos.name ?? fn ?? '<anonymous>';
  return `    at ${name} (${pos.source}:${pos.line}:${pos.column})`;
}
