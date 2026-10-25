'use client';

import { Banner } from '@/components/ui/banner';
import { formatAgo } from '@/lib/format';
import { useIngestOverview } from '../queries';
import { SEND_WAYS } from '../ways';

/** Names the first service that stopped sending, and links to that way's setup. */
export function SilentBanner() {
  const { data } = useIngestOverview();
  const silent = data?.streams.find((s) => s.state === 'silent');
  if (!silent) return null;
  const way = SEND_WAYS.find(
    (w) => w.apiWay === silent.way || (silent.way === 'syslog' && w.apiWay === 'drain'),
  );
  return (
    <Banner
      tone="danger"
      title={`${silent.serviceName} stopped sending data ${formatAgo(silent.lastReceivedAt)}.`}
    >
      {silent.host ? `Check the sender on ${silent.host}. ` : ''}
      {way && (
        <a
          href={`/integrations/${way.slug}/`}
          className="text-brand underline underline-offset-[3px]"
        >
          Open {way.title.toLowerCase()} setup
        </a>
      )}
    </Banner>
  );
}
