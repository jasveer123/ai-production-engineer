/** Builds the pull request title, body and commit message. Pure, so it is unit-tested. */

export interface PrBodyInput {
  incident: {
    id: string;
    title: string;
    severity: string;
    serviceName: string | null;
    environment: string | null;
    eventCount: number;
  };
  dashboardUrl: string;
  hypothesis: {
    summary: string;
    rationale: string | null;
    location: { file?: string; line?: number | null; symbol?: string | null } | null;
  } | null;
  evidence: { ref: string; title: string; sourceUrl: string | null }[];
  fix: {
    version: number;
    explanation: string | null;
    diffStat: { files: number; additions: number; deletions: number } | null;
    baseCommitSha: string;
    testPath: string | null;
  };
  runs: { kind: string; attempt: number; status: string; summary: Record<string, unknown> }[];
  approver: string;
}

const RUN_LABEL: Record<string, string> = {
  baseline: 'Existing tests before the change',
  reproduction: 'Regression test fails on the original code',
  policy: 'Patch policy checks',
  regression: 'Regression test with the patch',
  full_suite: 'Full test suite with the patch',
};

const ICON: Record<string, string> = { passed: '✅', failed: '❌', error: '⚠️', skipped: '⏭️' };

export function branchName(incidentId: string, version: number): string {
  return `ai-fix/incident-${incidentId.slice(0, 8)}-v${version}`;
}

export function prTitle(i: PrBodyInput): string {
  const t = i.incident.title.replace(/\s+/g, ' ').slice(0, 90);
  return `fix: ${t}`;
}

export function commitMessage(i: PrBodyInput): string {
  return `${prTitle(i)}\n\n${i.fix.explanation ?? ''}\n\nIncident: ${i.dashboardUrl}\nApproved-by: ${i.approver}\nGenerated-by: AI Production Engineer`.trim();
}

/** Only the latest attempt's validation, plus the pre-patch checks. */
function relevantRuns(runs: PrBodyInput['runs']) {
  const last = Math.max(
    0,
    ...runs.filter((r) => r.kind !== 'baseline' && r.kind !== 'reproduction').map((r) => r.attempt),
  );
  return runs.filter((r) => r.attempt === 0 || r.attempt === last);
}

export function prBody(i: PrBodyInput): string {
  const loc = i.hypothesis?.location;
  const where = loc?.file
    ? `\`${loc.file}${loc.line ? `:${loc.line}` : ''}\`${loc.symbol ? ` (${loc.symbol})` : ''}`
    : 'unknown';
  const lines = [
    '## Summary',
    '',
    `Fixes **${i.incident.title}** in \`${i.incident.serviceName ?? 'unknown service'}\` (${i.incident.environment ?? 'unknown env'}), severity ${i.incident.severity}, ${i.incident.eventCount} occurrences.`,
    '',
    `[Open the incident in AI Production Engineer](${i.dashboardUrl})`,
    '',
    '## Root cause',
    '',
    i.hypothesis ? i.hypothesis.summary : '_No hypothesis recorded._',
    '',
    `Location: ${where}`,
    ...(i.hypothesis?.rationale ? ['', `Why: ${i.hypothesis.rationale}`] : []),
    '',
    '## Evidence',
    '',
    ...(i.evidence.length
      ? i.evidence.map(
          (e) => `- **${e.ref}** ${e.sourceUrl ? `[${e.title}](${e.sourceUrl})` : e.title}`,
        )
      : ['- _None recorded_']),
    '',
    '## The change',
    '',
    i.fix.explanation ?? '',
    '',
    i.fix.diffStat
      ? `${i.fix.diffStat.files} file(s), +${i.fix.diffStat.additions} −${i.fix.diffStat.deletions}, based on \`${i.fix.baseCommitSha.slice(0, 7)}\` (the deployed commit). Includes the regression test \`${i.fix.testPath ?? ''}\`.`
      : '',
    '',
    '## Validation (isolated sandbox, no network)',
    '',
    '| Check | Result | Details |',
    '|---|---|---|',
    ...relevantRuns(i.runs).map((r) => {
      const s = r.summary as {
        tests?: number;
        failures?: number;
        errors?: number;
        reason?: string;
      };
      const details =
        typeof s.tests === 'number'
          ? `${s.tests - (s.failures ?? 0) - (s.errors ?? 0)}/${s.tests} passed`
          : String(s.reason ?? '').replace(/_/g, ' ');
      return `| ${RUN_LABEL[r.kind] ?? r.kind} | ${ICON[r.status] ?? ''} ${r.status} | ${details} |`;
    }),
    '',
    '## Known limitations',
    '',
    '- The patch and the regression test were written by an AI model and validated automatically. Review them like any other change.',
    "- Validation ran this package's tests offline at the pinned commit. Integration paths that need the network or a real database were not exercised.",
    '- The branch is based on the deployed commit; if the default branch has moved on, GitHub shows any conflicts here.',
    '- Nothing is merged or deployed automatically.',
    '',
    `---\nOpened by AI Production Engineer after approval by ${i.approver}.`,
  ];
  return lines.join('\n');
}
