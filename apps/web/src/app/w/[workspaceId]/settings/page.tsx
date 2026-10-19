'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENTS,
  SEVERITIES,
  type NotificationChannelWithSecret,
  type NotificationEvent,
  type NotificationTestResult,
  type Severity,
  type SeverityRule,
} from '@ape/api-contracts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
} from '@/components/ui';
import {
  useApprovalPolicy,
  useCreateNotificationChannel,
  useDeleteNotificationChannel,
  useNotificationChannels,
  useNotificationDeliveries,
  useSetApprovalPolicy,
  useSetSeverityRules,
  useSeverityRules,
  useTestNotificationChannel,
  useUpdateNotificationChannel,
  useWorkspace,
} from '@/lib/queries';
import { atLeast } from '@/lib/roles';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

function SecretOnce({
  channel,
  onClose,
}: {
  channel: NotificationChannelWithSecret;
  onClose: () => void;
}) {
  return (
    <Card className="mb-6 border-accent/50 p-4">
      <p className="font-medium">Signing secret for “{channel.name}”</p>
      <p className="mt-1 text-sm text-subtle">Shown once. Store it with the receiving service.</p>
      <p className="mt-3 font-mono text-xs break-all select-all">{channel.signingSecret}</p>
      <p className="mt-3 text-xs text-subtle">
        Each request carries <code>x-ape-timestamp</code>, <code>x-ape-event</code> and{' '}
        <code>x-ape-signature: sha256=HMAC(secret, timestamp.body)</code>. Reject requests older
        than 5 minutes.
      </p>
      <Button className="mt-4" variant="secondary" onClick={onClose}>
        I’ve saved it
      </Button>
    </Card>
  );
}

function AddChannel({
  ws,
  onCreated,
}: {
  ws: string;
  onCreated: (c: NotificationChannelWithSecret) => void;
}) {
  const create = useCreateNotificationChannel(ws);
  const [kind, setKind] = useState<'slack' | 'webhook'>('slack');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [minSeverity, setMinSeverity] = useState<Severity>('low');
  const [events, setEvents] = useState<NotificationEvent[]>([...NOTIFICATION_EVENTS]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const common = { name, events, minSeverity };
    create.mutate(
      kind === 'slack' ? { kind, webhookUrl: url, ...common } : { kind, url, ...common },
      {
        onSuccess: (c) => {
          setName('');
          setUrl('');
          onCreated(c);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-line p-4">
      <p className="text-sm font-medium">Add a channel</p>
      <div className="grid gap-3 md:grid-cols-[10rem_1fr_2fr]">
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as 'slack' | 'webhook')}>
            <option value="slack">Slack</option>
            <option value="webhook">Webhook</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'slack' ? '#incidents' : 'PagerDuty bridge'}
          />
        </Field>
        <Field label={kind === 'slack' ? 'Incoming webhook URL' : 'HTTPS URL'}>
          <Input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              kind === 'slack'
                ? 'https://hooks.slack.com/services/…'
                : 'https://example.com/hooks/ape'
            }
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Notify on</legend>
        <div className="grid gap-1.5 md:grid-cols-2">
          {NOTIFICATION_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={events.includes(ev)}
                onChange={(e) =>
                  setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))
                }
              />
              {NOTIFICATION_EVENT_LABELS[ev]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Minimum severity">
          <Select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as Severity)}>
            {[...SEVERITIES].reverse().map((s) => (
              <option key={s} value={s}>
                {s === 'low' ? 'All severities' : `${s} and above`}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={create.isPending || events.length === 0}>
          Add channel
        </Button>
      </div>
      <ErrorBox error={create.error} />
      <p className="text-xs text-subtle">
        Messages contain the incident title, severity, status and a link, never code, stack traces
        or evidence. Webhook URLs must be public HTTPS addresses; redirects are not followed.
      </p>
    </form>
  );
}

function Notifications({ ws, isAdmin }: { ws: string; isAdmin: boolean }) {
  const channels = useNotificationChannels(ws);
  const deliveries = useNotificationDeliveries(ws, isAdmin);
  const update = useUpdateNotificationChannel(ws);
  const remove = useDeleteNotificationChannel(ws);
  const test = useTestNotificationChannel(ws);
  const [secret, setSecret] = useState<NotificationChannelWithSecret | null>(null);
  const [tested, setTested] = useState<Record<string, NotificationTestResult>>({});

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-base font-semibold">Notifications</h2>
      <p className="mb-4 text-sm text-subtle">
        Tell people when an incident starts, a fix needs review, or recovery is verified.
      </p>
      {secret && <SecretOnce channel={secret} onClose={() => setSecret(null)} />}
      <Card>
        {channels.isPending ? (
          <Loading />
        ) : channels.data?.length ? (
          <Table head={['Channel', 'Sends', 'Status', ...(isAdmin ? [''] : [])]}>
            {channels.data.map((c) => (
              <tr key={c.id}>
                <Td>
                  <p className="font-medium">
                    {c.name} <span className="text-xs font-normal text-subtle">· {c.kind}</span>
                  </p>
                  <p className="font-mono text-xs text-subtle">{c.target}</p>
                </Td>
                <Td className="text-xs text-subtle">
                  {c.events.length === NOTIFICATION_EVENTS.length
                    ? 'All events'
                    : c.events.map((e) => NOTIFICATION_EVENT_LABELS[e]).join(', ')}
                  <br />
                  {c.minSeverity === 'low' ? 'any severity' : `${c.minSeverity} and above`}
                </Td>
                <Td className="text-xs">
                  {c.enabled ? (
                    <Badge tone={c.lastError ? 'failure' : 'connected'}>
                      {c.lastError ? 'failing' : 'active'}
                    </Badge>
                  ) : (
                    <Badge tone="disconnected">paused</Badge>
                  )}
                  <p className="mt-1 text-subtle">Last sent {when(c.lastDeliveryAt)}</p>
                  {c.lastError && <p className="mt-1 text-warn">{c.lastError}</p>}
                  {tested[c.id] && (
                    <p className={`mt-1 ${tested[c.id]!.ok ? 'text-ok' : 'text-danger'}`}>
                      Test: {tested[c.id]!.ok ? 'delivered' : tested[c.id]!.error}
                    </p>
                  )}
                </Td>
                {isAdmin && (
                  <Td className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      disabled={test.isPending}
                      onClick={() =>
                        test.mutate(c.id, {
                          onSuccess: (r) => setTested((t) => ({ ...t, [c.id]: r })),
                        })
                      }
                    >
                      Send test
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: c.id, enabled: !c.enabled })}
                    >
                      {c.enabled ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete the channel “${c.name}”?`)) remove.mutate(c.id);
                      }}
                    >
                      Delete
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No notification channels"
            hint={
              isAdmin ? 'Add Slack or a webhook below.' : 'An admin can add Slack or a webhook.'
            }
          />
        )}
        {isAdmin && <AddChannel ws={ws} onCreated={(c) => c.signingSecret && setSecret(c)} />}
      </Card>
      <div className="mt-2">
        <ErrorBox error={update.error ?? remove.error ?? test.error} />
      </div>

      {isAdmin && (deliveries.data?.length ?? 0) > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold">Recent deliveries</h3>
          <Card>
            <Table head={['When', 'Channel', 'Event', 'Result']}>
              {deliveries.data!.map((d) => (
                <tr key={d.id}>
                  <Td className="text-xs text-subtle">{when(d.sentAt ?? d.createdAt)}</Td>
                  <Td>{d.channelName}</Td>
                  <Td className="text-xs">{d.eventType}</Td>
                  <Td className="text-xs">
                    <Badge tone={d.status === 'sent' ? 'success' : 'denied'}>{d.status}</Badge>
                    {d.attempts > 1 && <span className="ml-2 text-subtle">{d.attempts} tries</span>}
                    {d.error && <p className="mt-1 text-subtle">{d.error}</p>}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </section>
  );
}

const blankRule = (): SeverityRule => ({ severity: 'medium' });

function SeverityRules({ ws, isAdmin }: { ws: string; isAdmin: boolean }) {
  const rules = useSeverityRules(ws);
  const save = useSetSeverityRules(ws);
  const [draft, setDraft] = useState<SeverityRule[] | null>(null);
  useEffect(() => {
    if (rules.data && draft === null) setDraft(rules.data);
  }, [rules.data, draft]);
  if (!draft) return <Loading />;

  const set = (i: number, patch: Partial<SeverityRule>) =>
    setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const text = (v: string) => (v.trim() ? v.trim() : undefined);

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-base font-semibold">Severity rules</h2>
      <p className="mb-4 text-sm text-subtle">
        New incidents get the severity of the first matching rule. Empty fields match anything.
        After your rules: production is high, everything else medium.
      </p>
      <Card className="p-4">
        {draft.length === 0 && <p className="mb-3 text-sm text-subtle">No custom rules.</p>}
        <div className="space-y-2">
          {draft.map((r, i) => (
            <div key={i} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_1fr_9rem_auto]">
              <Input
                aria-label="Environment"
                placeholder="Environment"
                disabled={!isAdmin}
                value={r.environment ?? ''}
                onChange={(e) => set(i, { environment: text(e.target.value) })}
              />
              <Input
                aria-label="Service"
                placeholder="Service"
                disabled={!isAdmin}
                value={r.serviceName ?? ''}
                onChange={(e) => set(i, { serviceName: text(e.target.value) })}
              />
              <Input
                aria-label="Error type"
                placeholder="Error type (e.g. TypeError)"
                disabled={!isAdmin}
                value={r.errorType ?? ''}
                onChange={(e) => set(i, { errorType: text(e.target.value) })}
              />
              <Select
                aria-label="Severity"
                disabled={!isAdmin}
                value={r.severity}
                onChange={(e) => set(i, { severity: e.target.value as Severity })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              {isAdmin && (
                <Button
                  variant="ghost"
                  aria-label={`Remove rule ${i + 1}`}
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setDraft([...draft, blankRule()])}>
              Add rule
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>
              Save rules
            </Button>
            {save.isSuccess && <span className="self-center text-sm text-ok">Saved</span>}
          </div>
        )}
        <div className="mt-2">
          <ErrorBox error={save.error} />
        </div>
      </Card>
    </section>
  );
}

function ApprovalPolicy({ ws, isOwner }: { ws: string; isOwner: boolean }) {
  const policy = useApprovalPolicy(ws);
  const save = useSetApprovalPolicy(ws);
  if (!policy.data) return <Loading />;
  return (
    <section className="mb-10">
      <h2 className="mb-1 text-base font-semibold">Pull request approval</h2>
      <p className="mb-4 text-sm text-subtle">
        Who may approve opening a pull request for a validated fix. Checked again when the pull
        request is created, so lowering someone’s role takes effect immediately.
      </p>
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Lowest role that can approve">
          <Select
            disabled={!isOwner || save.isPending}
            value={policy.data.prMinRole}
            onChange={(e) =>
              save.mutate({ prMinRole: e.target.value as 'owner' | 'admin' | 'engineer' })
            }
          >
            <option value="engineer">Engineer</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </Select>
        </Field>
        {!isOwner && <p className="text-sm text-subtle">Only owners can change this.</p>}
        <ErrorBox error={save.error} />
      </Card>
    </section>
  );
}

export default function SettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  if (!ws.data) return <Loading />;
  const role = ws.data.role;
  return (
    <div className="max-w-5xl">
      <PageHeader title="Settings" description="Notifications, severity and approval rules." />
      <Notifications ws={workspaceId} isAdmin={atLeast(role, 'admin')} />
      <SeverityRules ws={workspaceId} isAdmin={atLeast(role, 'admin')} />
      <ApprovalPolicy ws={workspaceId} isOwner={role === 'owner'} />
    </div>
  );
}
