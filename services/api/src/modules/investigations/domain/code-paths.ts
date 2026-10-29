export interface Frame {
  fn: string | null;
  path: string;
  line: number;
}

const FRAME = /at\s+(?:async\s+)?(?:([^\s(]+)\s+\()?([^():\s][^():]*):(\d+)(?::\d+)?\)?/;

export function parseFrames(stack: string[]): Frame[] {
  const frames: Frame[] = [];
  for (const raw of stack) {
    const m = FRAME.exec(raw);
    if (!m) continue;
    const path = m[2]!;

    if (path.includes('node_modules') || path.startsWith('node:') || path.startsWith('internal/'))
      continue;
    frames.push({ fn: m[1] ?? null, path, line: Number(m[3]) });
  }
  return frames;
}

export function mapToRepoPath(runtimePath: string, repoPaths: Set<string>): string | null {
  const parts = runtimePath.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join('/');
    if (repoPaths.has(candidate)) return candidate;
  }
  return null;
}

export function excerpt(
  source: string,
  line: number,
  radius = 30,
): { text: string; from: number; to: number } {
  const lines = source.split('\n');
  const from = Math.max(1, line - radius);
  const to = Math.min(lines.length, line + radius);
  const width = String(to).length;
  const text = lines
    .slice(from - 1, to)
    .map((l, i) => {
      const n = from + i;
      return `${n === line ? '>>' : '  '} ${String(n).padStart(width)} | ${l}`;
    })
    .join('\n');
  return { text, from, to };
}
