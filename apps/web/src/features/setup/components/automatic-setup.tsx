'use client';

import { Card, CardHeader } from '@/components/ui/card';
import { AgentInstallPanel } from './agent-install-panel';
import { DrainPanel } from './drain-panel';
import { LocalUrlWarning } from './local-url-warning';
import { SetupPrPanel } from './setup-pr-panel';

export function AutomaticSetup({ slug }: { slug: string }) {
  const body =
    slug === 'package' ? (
      <SetupPrPanel kind="agent" />
    ) : slug === 'server-agent' ? (
      <AgentInstallPanel />
    ) : slug === 'log-drain' ? (
      <DrainPanel />
    ) : null;
  if (!body) return null;
  return (
    <Card as="section" className="grid gap-4">
      <CardHeader
        eyebrow="Automatic"
        title={slug === 'server-agent' ? 'Install with one command' : 'Let us set it up'}
      />
      {slug !== 'package' && <LocalUrlWarning />}
      {body}
      <p className="m-0 text-[13px] text-ink-muted">
        Prefer to do it by hand? The steps are below.
      </p>
    </Card>
  );
}
