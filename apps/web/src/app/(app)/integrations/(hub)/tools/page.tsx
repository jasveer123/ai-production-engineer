import type { Metadata } from 'next';
import { IntegrationTabs } from '@/features/integrations/components/integration-tabs';
import { ToolsGrid } from '@/features/integrations/components/tools-grid';

export const metadata: Metadata = { title: 'Connect tools' };

export default function ToolsPage() {
  return (
    <section aria-labelledby="tools-title" className="grid gap-4">
      <IntegrationTabs current="/integrations/tools/" />
      <div className="grid gap-1">
        <h2 id="tools-title" className="font-display text-xl font-semibold leading-7">
          Connect the tools you already use
        </h2>
        <p className="m-0 max-w-[70ch] text-ink-muted">
          Your data stays in these tools. Way 6 lets their alerts open incidents here. Way 7 lets
          the AI read their data while it investigates, read-only.
        </p>
      </div>
      <ToolsGrid />
    </section>
  );
}
