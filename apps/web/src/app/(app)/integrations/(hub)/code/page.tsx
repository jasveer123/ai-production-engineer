import type { Metadata } from 'next';
import { CodeCards } from '@/features/integrations/components/code-cards';
import { IntegrationTabs } from '@/features/integrations/components/integration-tabs';

export const metadata: Metadata = { title: 'Connect code' };

export default function CodePage() {
  return (
    <section aria-labelledby="code-title" className="grid gap-4">
      <IntegrationTabs current="/integrations/code/" />
      <div className="grid gap-1">
        <h2 id="code-title" className="font-display text-xl font-semibold leading-7">
          Connect your code and deploys
        </h2>
        <p className="m-0 max-w-[70ch] text-ink-muted">
          The AI reads your code at the deployed commit and opens a pull request only after you
          approve a fix.
        </p>
      </div>
      <CodeCards />
    </section>
  );
}
