/** Stack-frame parsing and mapping from runtime file paths to repository paths. */

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
    // Library and runtime frames are never the app's root cause location.
    if (path.includes('node_modules') || path.startsWith('node:') || path.startsWith('internal/'))
      continue;
    frames.push({ fn: m[1] ?? null, path, line: Number(m[3]) });
  }
  return frames;
}

/**
 * Finds the repository file a runtime path refers to by the longest matching path suffix.
 * "/app/api/src/services/checkout.ts" or "/Users/x/demo-shop/api/src/services/checkout.ts"
 * both map to "api/src/services/checkout.ts". Returns null when nothing matches (never guesses).
 */
export function mapToRepoPath(runtimePath: string, repoPaths: Set<string>): string | null {
  const parts = runtimePath.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join('/');
    if (repoPaths.has(candidate)) return candidate;
  }
  return null;
}

/** Numbered lines around `line`, with the line itself marked. */
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
