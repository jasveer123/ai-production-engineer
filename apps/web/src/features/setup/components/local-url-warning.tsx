'use client';

import { Banner } from '@/components/ui/banner';
import { useSetupCapabilities } from '../queries';

export function LocalUrlWarning() {
  const caps = useSetupCapabilities();
  if (!caps.data?.publicUrlIsLocal) return null;
  return (
    <Banner tone="info" title={`This server is reachable only at ${caps.data.publicUrl}.`}>
      Cloud tools (Vercel, Heroku, Render, Grafana Cloud, Sentry, Datadog, AWS) cannot send to
      localhost. Set PUBLIC_API_URL and PUBLIC_INGEST_URL to a public address (for example a tunnel)
      to use them.
    </Banner>
  );
}
