import type { Metadata } from 'next';
import { IntegrationTabs } from '@/features/integrations/components/integration-tabs';
import { SendWaysGrid } from '@/features/integrations/components/send-ways-grid';

export const metadata: Metadata = { title: 'Integrations' };

export default function SendDataPage() {
  return (
    <section aria-labelledby="send-title" className="grid gap-4">
      <IntegrationTabs current="/integrations/" />
      <div className="grid gap-1">
        <h2 id="send-title" className="font-display text-xl font-semibold leading-7">
          Send data from your app
        </h2>
        <p className="m-0 max-w-[70ch] text-ink-muted">
          Your app or server sends logs, traces and errors to us. Every way uses the same token.
        </p>
      </div>
      <SendWaysGrid />
    </section>
  );
}
