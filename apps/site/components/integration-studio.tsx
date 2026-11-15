'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Code2, Server, Workflow } from 'lucide-react';
import { IntegrationIcon } from './integration-icon';
import { asset } from '@/data/base-path';
const groups = [
  {
    name: 'Infrastructure',
    icon: Server,
    title: 'Start where your services run.',
    description:
      'Collect operational signals from your infrastructure and bring them into the investigation.',
    tools: [
      {
        id: 'opentelemetry',
        name: 'OpenTelemetry',
        detail: 'Logs, traces & metric points',
      },
      { id: 'docker', name: 'Docker', detail: 'Container log collection' },
      {
        id: 'kubernetes',
        name: 'Kubernetes',
        detail: 'Cluster collection setup',
      },
      { id: 'aws', name: 'AWS', detail: 'Cloud collection guide' },
    ],
    output: ['Service context', 'Operational events', 'Request evidence'],
  },
  {
    name: 'Application code',
    icon: Code2,
    title: 'Give every request a story.',
    description:
      'Send application events and request context with the integration that fits your codebase.',
    tools: [
      {
        id: 'javascript',
        name: 'JavaScript',
        detail: 'JavaScript & TypeScript guide',
      },
      { id: 'python', name: 'Python', detail: 'Python instrumentation guide' },
      { id: 'http', name: 'HTTP', detail: 'Direct event ingestion' },
      {
        id: 'opentelemetry',
        name: 'OpenTelemetry',
        detail: 'Instrument with OTLP',
      },
    ],
    output: ['Application events', 'Exception context', 'Request traces'],
  },
  {
    name: 'Existing pipelines',
    icon: Workflow,
    title: 'Keep the pipeline you already know.',
    description:
      'Forward signals with your existing collector. Configure the destination once and keep context moving.',
    tools: [
      { id: 'vector', name: 'Vector', detail: 'Forward with Vector' },
      {
        id: 'fluent-bit',
        name: 'Fluent Bit',
        detail: 'Configure log forwarding',
      },
      {
        id: 'ubuntu',
        name: 'Ubuntu / Debian',
        detail: 'Host collection guide',
      },
      { id: 'docker', name: 'Docker', detail: 'Container collection guide' },
    ],
    output: ['Structured events', 'Source attributes', 'Investigation context'],
  },
];
export function IntegrationStudio() {
  const [active, setActive] = useState(0);
  const group = groups[active];
  return (
    <div className="integration-studio">
      <div className="studio-tabs" aria-label="Integration sources">
        {groups.map((g, i) => (
          <button key={g.name} aria-pressed={i === active} onClick={() => setActive(i)}>
            <g.icon size={16} />
            {g.name}
          </button>
        ))}
      </div>
      <div className="studio-body" key={active}>
        <div className="studio-intro">
          <span className="story-eyebrow">CONNECTED CONTEXT / 0{active + 1}</span>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
          <Link href="/integrations/#integration-guides">
            Browse all setup guides <ArrowRight size={14} />
          </Link>
        </div>
        <div className="studio-tools">
          {group.tools.map((t) => (
            <Link key={t.id} href={`/docs/${t.id}/`}>
              <IntegrationIcon id={t.id} />
              <div>
                <strong>{t.name}</strong>
                <small>{t.detail}</small>
              </div>
              <ArrowUpRight size={13} />
            </Link>
          ))}
        </div>
        <div className="studio-output">
          <img src={asset('/brand/logo.svg')} alt="Pramaan" width="40" height="40" />
          <span>Ready for investigation</span>
          {group.output.map((o) => (
            <p key={o}>
              <Check size={13} />
              {o}
            </p>
          ))}
          <small>Configure a source to bring your own evidence into Pramaan.</small>
        </div>
      </div>
    </div>
  );
}
