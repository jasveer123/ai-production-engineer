'use client';

import { NOTIFICATION_EVENT_LABELS, type NotificationEvent } from '@ape/api-contracts';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useNotificationDeliveries } from '../queries';

export function RecentDeliveries() {
  const deliveries = useNotificationDeliveries(true);
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="m-0 font-display text-base font-semibold">Recent deliveries</h2>
        <p className="m-0 text-[13px] text-ink-muted">
          Each message we tried to send, and what the channel answered.
        </p>
      </div>
      {deliveries.isPending ? (
        <p className="m-0 text-ink-muted">Loading deliveries…</p>
      ) : deliveries.isError ? (
        <Banner tone="danger" title="Could not load deliveries.">
          {errorMessage(deliveries.error)}
        </Banner>
      ) : deliveries.data.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">
          Nothing sent yet. Use Send test to try a channel.
        </p>
      ) : (
        <Table label="Recent notification deliveries">
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Channel</Th>
              <Th>Event</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {deliveries.data.map((d) => (
              <Tr key={d.id}>
                <Td className="whitespace-nowrap text-[13px] text-ink-muted">
                  {formatDateTime(d.createdAt)} UTC
                </Td>
                <Td className="font-semibold">{d.channelName}</Td>
                <Td className="text-[13px]">
                  {NOTIFICATION_EVENT_LABELS[d.eventType as NotificationEvent] ?? d.eventType}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    {d.status === 'sent' ? (
                      <Badge tone="ok">Sent</Badge>
                    ) : (
                      <Badge tone="danger">Failed</Badge>
                    )}
                    <span className="text-[13px] text-ink-muted">
                      {d.responseStatus ? `HTTP ${d.responseStatus}` : ''}
                      {d.attempts > 1 ? ` · ${d.attempts} attempts` : ''}
                    </span>
                  </div>
                  {d.error && <div className="text-[13px] text-danger">{d.error}</div>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
