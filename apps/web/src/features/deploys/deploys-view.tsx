'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useServices } from '@/features/services/queries';
import { errorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDeployments } from './queries';

export function DeploysView() {
  const services = useServices();
  const [filter, setFilter] = useState('');
  const [service, environment] = filter ? filter.split('|') : [];
  const deploys = useDeployments({ service, environment });
  const repoOf = (name: string, env: string) =>
    services.data?.find((s) => s.name === name && s.environment === env)?.repositoryFullName;

  return (
    <>
      <PageHeader
        title="Deploys"
        description="Every deploy your pipeline reported, newest first. Incidents and fixes are checked against these markers."
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="deploy-service" label="Service">
          <Select
            id="deploy-service"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-w-[240px]"
          >
            <option value="">All services</option>
            {services.data?.map((s) => (
              <option key={s.id} value={`${s.name}|${s.environment}`}>
                {s.name} ({s.environment})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {deploys.isPending ? (
        <p className="text-ink-muted">Loading deploys…</p>
      ) : deploys.isError ? (
        <Banner tone="danger" title="Could not load deploys.">
          {errorMessage(deploys.error)}
        </Banner>
      ) : deploys.data.length === 0 ? (
        <EmptyState
          icon="send"
          title={filter ? 'No deploys for this service yet' : 'No deploys yet'}
          action={
            <ButtonLink href="/integrations/code/" variant="secondary">
              Set up the deploy webhook
            </ButtonLink>
          }
        >
          Add one signed request to the end of your deploy pipeline. Each deploy then shows here
          with its commit, and the AI can link incidents to the change that caused them.
        </EmptyState>
      ) : (
        <Table label="Deploys">
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Version</Th>
              <Th>Commit</Th>
              <Th>Deployed</Th>
              <Th>Reported by</Th>
            </tr>
          </thead>
          <tbody>
            {deploys.data.map((d) => {
              const repo = repoOf(d.serviceName, d.environment);
              const sha = d.commitSha.slice(0, 7);
              return (
                <Tr key={d.id}>
                  <Td>
                    <Link href={`/deploys/${d.id}/`} className="font-semibold hover:text-brand">
                      {d.serviceName}
                    </Link>
                    <div className="text-[13px] text-ink-muted">{d.environment}</div>
                  </Td>
                  <Td className="font-mono text-[13px]">
                    {d.version ?? <span className="font-sans text-ink-muted">Not sent</span>}
                  </Td>
                  <Td className="font-mono text-[13px]">
                    {repo ? (
                      <a
                        href={`https://github.com/${repo}/commit/${d.commitSha}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline underline-offset-[3px]"
                      >
                        {sha}
                      </a>
                    ) : (
                      sha
                    )}
                  </Td>
                  <Td>
                    <div>{formatAgo(d.deployedAt)}</div>
                    <div className="text-[13px] text-ink-muted">
                      {formatDateTime(d.deployedAt)} UTC
                    </div>
                  </Td>
                  <Td className="text-[13px] text-ink-muted">
                    {d.integrationName ?? 'Deleted webhook'}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
