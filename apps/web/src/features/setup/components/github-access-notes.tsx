'use client';

import type { GitHubOverview } from '@ape/api-contracts';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

const ext = 'inline-flex items-center gap-1 text-brand underline underline-offset-[3px]';

/** Plain-language fixes for what GitHub is not allowing, each with a direct link. */
export function GitHubAccessNotes({
  overview,
  need,
  onRefresh,
  refreshing,
}: {
  overview: GitHubOverview;
  need: 'setupPullRequest' | 'deployWorkflow' | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const inst = overview.installations[0];
  if (!inst) return null;
  const missing = need ? overview.missing[need] : [];
  return (
    <div className="grid gap-2">
      {missing.length > 0 && (
        <Banner tone="danger" title={`The GitHub App is missing ${missing.join(', ')}.`}>
          {overview.appPermissionsUrl ? (
            <a href={overview.appPermissionsUrl} target="_blank" rel="noreferrer" className={ext}>
              Add it in the App&apos;s permissions <Icon name="external" size="sm" />
            </a>
          ) : (
            "Add it in the GitHub App's permissions"
          )}
          , then{' '}
          <a href={inst.manageUrl} target="_blank" rel="noreferrer" className={ext}>
            accept the new permissions on your installation <Icon name="external" size="sm" />
          </a>
          .
        </Banner>
      )}
      {overview.unreachableServiceRepos.length > 0 && (
        <Banner
          tone="info"
          title={`Not shared with the GitHub App: ${overview.unreachableServiceRepos.join(', ')}.`}
        >
          These are set on your services but the AI cannot read them.{' '}
          <a href={inst.manageUrl} target="_blank" rel="noreferrer" className={ext}>
            Add them on GitHub <Icon name="external" size="sm" />
          </a>
        </Banner>
      )}
      <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
        Don&apos;t see a repository?
        <a href={inst.manageUrl} target="_blank" rel="noreferrer" className={ext}>
          Choose repositories on GitHub <Icon name="external" size="sm" />
        </a>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing}>
          <Icon name="refresh" size="sm" /> {refreshing ? 'Checking…' : 'Refresh'}
        </Button>
      </p>
    </div>
  );
}
