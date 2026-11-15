import type { ErrorFrameView } from '@ape/api-contracts';

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
  sourcesContent: (string | null)[];
}

export function parseSourceMap(text: string): ParsedMap {
  const raw = JSON.parse(text) as {
    sources?: string[];
    names?: string[];
    mappings?: string;
    sourcesContent?: unknown[];
  };
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
  const sourcesContent = Array.isArray(raw.sourcesContent)
    ? raw.sourcesContent.map((c) => (typeof c === 'string' ? c : null))
    : [];
  return { sources: raw.sources, names: raw.names ?? [], lines, sourcesContent };
}

export function originalPosition(
  map: ParsedMap,
  line: number,
  column: number,
): { source: string; index: number; line: number; column: number; name: string | null } | null {
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
    index: best.source,
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

const CONTEXT_LINES = 5;

export function codeContext(
  map: ParsedMap,
  index: number,
  line: number,
): { pre: string[]; line: string; post: string[] } | null {
  const content = map.sourcesContent[index];
  if (!content) return null;
  const rows = content.split('\n');
  const at = line - 1;
  if (at < 0 || at >= rows.length) return null;
  const cut = (s: string) => s.slice(0, 400);
  return {
    pre: rows.slice(Math.max(0, at - CONTEXT_LINES), at).map(cut),
    line: cut(rows[at]!),
    post: rows.slice(at + 1, at + 1 + CONTEXT_LINES).map(cut),
  };
}

export function mapFrame(
  frame: ErrorFrameView,
  find: (file: string) => ParsedMap | null,
): ErrorFrameView {
  if (!frame.file || frame.line === null || frame.column === null) return frame;
  const map = find(frame.file.split('/').pop()!.split('?')[0]!);
  if (!map) return frame;
  const pos = originalPosition(map, frame.line, frame.column);
  if (!pos) return frame;
  return {
    ...frame,
    function: pos.name ?? frame.function,
    file: pos.source,
    line: pos.line,
    column: pos.column,
    context: codeContext(map, pos.index, pos.line) ?? frame.context,
    inApp: frame.inApp && !pos.source.includes('node_modules'),
    mapped: true,
  };
}
