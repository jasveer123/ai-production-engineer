'use client';

import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FormError } from '@/components/ui/form';
import { errorMessage } from '@/lib/api';
import { useIntegrations } from '../queries';
import { CARD } from './card-styles';
import { DeployCard } from './deploy-card';
import { GitHubCard } from './github-card';

export function CodeCards() {
  const integrations = useIntegrations();
  if (integrations.isPending) return <ListSkeleton label="Loading" />;
  if (integrations.isError)
    return <FormError>Could not load integrations: {errorMessage(integrations.error)}</FormError>;
  const live = integrations.data.filter((i) => i.status !== 'disconnected');
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      <GitHubCard row={live.find((i) => i.provider === 'github')} />
      <article className={CARD}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-surface-sunken font-display font-bold text-ink">
            GL
          </span>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">GitLab</h3>
            <p className="m-0 text-[13px] text-ink-muted">Merge requests</p>
          </div>
          <Badge>Coming soon</Badge>
        </div>
        <p className="m-0 text-[13px] leading-5 text-ink-muted">
          GitLab support is planned. GitHub is the only code host today.
        </p>
      </article>
      <DeployCard row={live.find((i) => i.provider === 'deploy_webhook')} />
    </div>
  );
}
