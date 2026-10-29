import { createTwoFilesPatch } from 'diff';

export interface Edit {
  path: string;
  find: string;
  replace: string;
}

export interface PatchOutcome {
  ok: boolean;
  files: Record<string, string>;
  diff: string;
  diffStat: { files: number; additions: number; deletions: number };
  violations: string[];
}

export const PATCH_POLICY = {
  maxFiles: 3,
  maxChangedLines: 80,
  forbiddenPaths: [
    /(^|\/)package\.json$/,
    /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/,
    /(^|\/)\.github\//,
    /\.ya?ml$/,
    /(^|\/)Dockerfile/,
    /(^|\/)\.env/,
    /(^|\/)(test|tests|__tests__)\//,
    /\.(test|spec)\.[jt]sx?$/,
  ],
  forbiddenAdditions: [
    {
      re: /\bfetch\s*\(|https?:\/\/|\bnew\s+WebSocket\b|\brequire\(['"](http|https|net|dgram|dns)['"]\)/,
      why: 'adds a network call',
    },
    { re: /child_process|\bexecSync\b|\bspawn\(/, why: 'starts processes' },
    { re: /\beval\s*\(|new\s+Function\s*\(/, why: 'evaluates code dynamically' },
    { re: /process\.env\.[A-Z_]+\s*=(?!=)/, why: 'changes environment variables' },
  ],
};

function applyEdit(
  e: Edit,
  files: Record<string, string>,
  editable: Record<string, string>,
): { path: string; next: string } | { violation: string } {
  const path = e.path.replace(/^\.\//, '');
  if (PATCH_POLICY.forbiddenPaths.some((re) => re.test(path)))
    return { violation: `${path}: editing this kind of file is not allowed` };
  const current = files[path] ?? editable[path];
  if (current === undefined) return { violation: `${path}: not one of the files the fix may edit` };
  if (!e.find) return { violation: `${path}: empty "find" text` };
  const count = current.split(e.find).length - 1;
  if (count !== 1)
    return { violation: `${path}: "find" text must match exactly once (matched ${count} times)` };
  return { path, next: current.replace(e.find, () => e.replace) };
}

function diffFile(path: string, before: string, after: string) {
  const diff = createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, '', '', { context: 3 });
  const violations: string[] = [];
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
      for (const rule of PATCH_POLICY.forbiddenAdditions)
        if (rule.re.test(line))
          violations.push(`${path}: ${rule.why}: ${line.slice(1).trim().slice(0, 120)}`);
    } else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  if (before === after) violations.push(`${path}: edit changes nothing`);
  return { diff, additions, deletions, violations };
}

export function applyEdits(editable: Record<string, string>, edits: Edit[]): PatchOutcome {
  const violations: string[] = [];
  const files: Record<string, string> = {};
  if (edits.length === 0) violations.push('The patch contains no edits');

  for (const e of edits) {
    const result = applyEdit(e, files, editable);
    if ('violation' in result) violations.push(result.violation);
    else files[result.path] = result.next;
  }

  let diff = '';
  let additions = 0;
  let deletions = 0;
  for (const [path, after] of Object.entries(files)) {
    const d = diffFile(path, editable[path]!, after);
    diff += d.diff;
    additions += d.additions;
    deletions += d.deletions;
    violations.push(...d.violations);
  }

  const changed = Object.keys(files).length;
  if (changed > PATCH_POLICY.maxFiles)
    violations.push(`Touches ${changed} files (max ${PATCH_POLICY.maxFiles})`);
  if (additions + deletions > PATCH_POLICY.maxChangedLines) {
    violations.push(
      `Changes ${additions + deletions} lines (max ${PATCH_POLICY.maxChangedLines}); a fix should be minimal`,
    );
  }
  return {
    ok: violations.length === 0,
    files,
    diff,
    diffStat: { files: changed, additions, deletions },
    violations: [...new Set(violations)],
  };
}
