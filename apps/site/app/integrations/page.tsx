import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, GitBranch, Bell, Plug } from 'lucide-react';
import { IntegrationStudio } from '@/components/integration-studio';
import { Catalogue } from '@/components/catalogue';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
export const metadata: Metadata = {
  title: 'Integrations — Pramaan',
  description:
    'Connect OpenTelemetry, Docker, Kubernetes, Node.js, Python, HTTP and more. Setup guides synced from the Pramaan product.',
};
export default function IntegrationsPage() {
  return (
    <main id="main" className="integrations-page-v2">
      <section className="container page-hero">
        <HeroBackdrop />
        <span className="eyebrow">Integrations</span>
        <h1>
          Meet your stack
          <br />
          where it is.
        </h1>
        <p>
          Collect from infrastructure. Send from your code. Find the setup that fits your
          environment.
        </p>
        <div className="source-badge">
          <Plug size={14} />
          10 guides, synced from the product catalogue
        </div>
      </section>
      <section className="container integration-overview">
        <IntegrationStudio />
      </section>
      <section className="container catalogue-section" id="integration-guides">
        <Catalogue />
        <div className="connection-cards">
          {[
            {
              slug: 'github',
              title: 'Code & deployment context',
              text: 'Connect GitHub and deployment events to an investigation.',
              icon: GitBranch,
            },
            {
              slug: 'notifications',
              title: 'Notifications',
              text: 'Configure Slack, webhooks and the delivery providers your deployment uses.',
              icon: Bell,
            },
            {
              slug: 'existing-tools',
              title: 'Existing observability tools',
              text: 'Reader adapters for Grafana, Datadog, Sentry, Better Stack, CloudWatch and Elasticsearch.',
              icon: Plug,
            },
          ].map((c) => (
            <Link href={`/docs/${c.slug}/`} key={c.slug}>
              <c.icon size={20} />
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <span>
                Read the guide <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
