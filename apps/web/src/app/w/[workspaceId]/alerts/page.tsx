'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  ALERT_CONDITION_OPS,
  ALERT_SOURCE_KINDS,
  ALERT_SOURCE_LABELS,
  SEVERITIES,
  type AlertCondition,
  type AlertPreview,
  type AlertRoute,
  type AlertSource,
  type AlertSourceKind,
  type AlertSourceWithToken,
  type Severity,
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
  useAlertRoutes,
  useAlertSources,
  useAlerts,
  useCreateAlertRoute,
  useCreateAlertSource,
  useDeleteAlertRoute,
  useDeleteAlertSource,
  usePreviewAlert,
  useReorderAlertRoutes,
  useRotateAlertSource,
  useUpdateAlertRoute,
  useWorkspace,
} from '@/lib/queries';
import { atLeast } from '@/lib/roles';

type Tab = 'alerts' | 'sources' | 'routes';
const ago = (iso: string) => {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

// ----- Alerts -----

function AlertList({ ws }: { ws: string }) {
  const [status, setStatus] = useState<'firing' | 'resolved' | ''>('firing');
  const q = useAlerts(ws, { status: status || undefined, limit: 100 });
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="w-44">
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="firing">Firing</option>
            <option value="resolved">Resolved</option>
            <option value="">All</option>
          </Select>
        </div>
      </div>
      <Card>
        {q.isPending ? (
          <Loading />
        ) : !q.data?.length ? (
          <EmptyState
            title={status === 'firing' ? 'Nothing is firing' : 'No alerts'}
            hint="Connect a source on the Sources tab and alerts appear here as they arrive."
          />
        ) : (
          <Table head={['Severity', 'Alert', 'Source', 'Route → incident', 'Last fired']}>
            {q.data.map((a) => (
              <tr key={a.id}>
                <Td>
                  <Badge tone={a.status === 'resolved' ? 'resolved' : a.severity}>
                    {a.status === 'resolved' ? 'resolved' : a.severity}
                  </Badge>
                </Td>
                <Td>
                  <p className="font-medium">
                    {a.sourceUrl ? (
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {a.title}
                      </a>
                    ) : (
                      a.title
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-subtle">
                    {Object.entries(a.labels)
                      .slice(0, 4)
                      .map(([k, v]) => `${k}=${v}`)
                      .join('  ')}
                  </p>
                </Td>
                <Td className="text-xs">
                  {a.sourceName}
                  <br />
                  <span className="text-subtle">{ALERT_SOURCE_LABELS[a.sourceKind]}</span>
                </Td>
                <Td className="text-xs">
                  {a.routeName ? (
                    <>
                      {a.routeName}
                      <br />
                      {a.incidentId ? (
                        <Link
                          href={`/w/${ws}/incidents/${a.incidentId}`}
                          className="text-accent hover:underline"
                        >
                          {a.incidentTitle}
                        </Link>
                      ) : (
                        <span className="text-subtle">no incident (route only records)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-warn">No route matched</span>
                  )}
                </Td>
                <Td className="text-xs whitespace-nowrap text-subtle">
                  {ago(a.lastFiredAt)}
                  {a.occurrences > 1 && <span className="block">×{a.occurrences}</span>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

// ----- Sources -----

function setup(kind: AlertSourceKind, url: string, token: string): string {
  switch (kind) {
    case 'http':
      return `curl -X POST '${url}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"Checkout error rate above 5%","severity":"critical",
       "dedup_key":"checkout-errors","status":"firing",
       "metadata":{"service":"checkout","env":"production"}}'
# Send the same dedup_key with "status":"resolved" to resolve it.`;
    case 'alertmanager':
      return `# alertmanager.yml
receivers:
  - name: platform
    webhook_configs:
      - url: '${url}'
        send_resolved: true
        http_config:
          authorization:
            credentials: '${token}'`;
    case 'grafana':
      return `Alerting → Contact points → New → Webhook
URL:            ${url}
HTTP method:    POST
Authorization:  Bearer  ${token}`;
    case 'sentry':
      return `Settings → Integrations → WebHooks (or an Internal Integration with alert rules)
Callback URL: ${url}?token=${token}
Sentry cannot send custom headers, so the token goes in the URL.`;
    case 'datadog':
      return `Integrations → Webhooks → New
URL:     ${url}
Headers: {"Authorization": "Bearer ${token}"}
Payload: {"id":"$ID","title":"$EVENT_TITLE","body":"$EVENT_MSG",
          "alert_transition":"$ALERT_TRANSITION","aggregate":"$AGGREG_KEY",
          "alert_priority":"$ALERT_PRIORITY","tags":"$TAGS","link":"$LINK","date":"$DATE"}`;
    case 'heartbeat':
      return `# Ping at the end of the job (GET or POST). A missed ping raises an alert.
curl -fsS '${url}?token=${token}'`;
  }
}

function TokenOnce({ s, onClose }: { s: AlertSourceWithToken; onClose: () => void }) {
  return (
    <Card className="mb-4 border-accent/50 p-4">
      <p className="font-medium">Connect “{s.name}”</p>
      <p className="mt-1 text-sm text-subtle">
        The token is shown once. Rotate it from the list if it leaks.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-xs leading-relaxed select-all">
        {setup(s.kind, s.url, s.token)}
      </pre>
      <Button className="mt-3" variant="secondary" onClick={onClose}>
        I’ve saved it
      </Button>
    </Card>
  );
}

function Sources({ ws, isAdmin }: { ws: string; isAdmin: boolean }) {
  const q = useAlertSources(ws);
  const create = useCreateAlertSource(ws);
  const rotate = useRotateAlertSource(ws);
  const remove = useDeleteAlertSource(ws);
  const [created, setCreated] = useState<AlertSourceWithToken | null>(null);
  const [kind, setKind] = useState<AlertSourceKind>('alertmanager');
  const [name, setName] = useState('');
  const [everySeconds, setEverySeconds] = useState(3600);
  const [grace, setGrace] = useState(300);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      kind === 'heartbeat'
        ? { kind, name, intervalSeconds: everySeconds, graceSeconds: grace }
        : { kind, name },
      {
        onSuccess: (s) => {
          setCreated(s);
          setName('');
        },
      },
    );
  };

  const state = (s: AlertSource) => {
    if (s.heartbeat)
      return (
        <Badge
          tone={
            s.heartbeat.state === 'down'
              ? 'error'
              : s.heartbeat.state === 'up'
                ? 'connected'
                : 'pending'
          }
        >
          {s.heartbeat.state === 'pending' ? 'waiting for first ping' : s.heartbeat.state}
        </Badge>
      );
    return <Badge tone={s.status}>{s.status === 'pending' ? 'no alerts yet' : s.status}</Badge>;
  };

  return (
    <>
      {created && <TokenOnce s={created} onClose={() => setCreated(null)} />}
      <Card>
        {q.isPending ? (
          <Loading />
        ) : !q.data?.length ? (
          <EmptyState title="No alert sources" hint="Connect your monitoring tools below." />
        ) : (
          <Table head={['Source', 'Status', 'Last received', ...(isAdmin ? [''] : [])]}>
            {q.data.map((s) => (
              <tr key={s.id}>
                <Td>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-subtle">
                    {ALERT_SOURCE_LABELS[s.kind]}
                    {s.heartbeat &&
                      ` · every ${Math.round(s.heartbeat.intervalSeconds / 60)} min (+${Math.round(s.heartbeat.graceSeconds / 60)} min grace)`}
                  </p>
                  <p className="font-mono text-xs text-subtle">{s.url}</p>
                </Td>
                <Td>{state(s)}</Td>
                <Td className="text-xs text-subtle">
                  {s.heartbeat?.lastPingAt
                    ? ago(s.heartbeat.lastPingAt)
                    : s.lastReceivedAt
                      ? ago(s.lastReceivedAt)
                      : '—'}
                </Td>
                {isAdmin && (
                  <Td className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      disabled={rotate.isPending}
                      onClick={() => rotate.mutate(s.id, { onSuccess: setCreated })}
                    >
                      New token
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        if (confirm(`Disconnect “${s.name}”? Its token stops working.`))
                          remove.mutate(s.id);
                      }}
                    >
                      Disconnect
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </Table>
        )}
        {isAdmin && (
          <form
            onSubmit={submit}
            className="flex flex-wrap items-end gap-3 border-t border-line p-4"
          >
            <Field label="Type">
              <Select value={kind} onChange={(e) => setKind(e.target.value as AlertSourceKind)}>
                {ALERT_SOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ALERT_SOURCE_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name">
              <Input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'heartbeat' ? 'nightly-backup' : 'Production Prometheus'}
              />
            </Field>
            {kind === 'heartbeat' && (
              <>
                <Field label="Expected every (seconds)">
                  <Input
                    type="number"
                    min={30}
                    value={everySeconds}
                    onChange={(e) => setEverySeconds(Number(e.target.value))}
                  />
                </Field>
                <Field label="Grace (seconds)">
                  <Input
                    type="number"
                    min={0}
                    value={grace}
                    onChange={(e) => setGrace(Number(e.target.value))}
                  />
                </Field>
              </>
            )}
            <Button type="submit" disabled={create.isPending}>
              Add source
            </Button>
          </form>
        )}
      </Card>
      <div className="mt-2">
        <ErrorBox error={create.error ?? rotate.error ?? remove.error} />
      </div>
    </>
  );
}

// ----- Routes -----

const blankCondition = (): AlertCondition => ({
  field: 'label.env',
  op: 'eq',
  value: 'production',
});
const OP_LABEL: Record<AlertCondition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  regex: 'matches regex',
  exists: 'is set',
  not_exists: 'is not set',
};

function RouteForm({
  ws,
  sources,
  onDone,
}: {
  ws: string;
  sources: AlertSource[];
  onDone: () => void;
}) {
  const create = useCreateAlertRoute(ws);
  const [name, setName] = useState('');
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [conditions, setConditions] = useState<AlertCondition[]>([]);
  const [groupBy, setGroupBy] = useState('service');
  const [createIncident, setCreateIncident] = useState(true);
  const [severity, setSeverity] = useState<Severity | ''>('');
  const setCond = (i: number, patch: Partial<AlertCondition>) =>
    setConditions(conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <form
      className="space-y-4 border-t border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(
          {
            name,
            sourceIds,
            conditions,
            groupBy: groupBy
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean),
            createIncident,
            incidentSeverity: severity || null,
          },
          { onSuccess: onDone },
        );
      }}
    >
      <p className="text-sm font-medium">New route</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <Input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production checkout"
          />
        </Field>
        <Field label="Group alerts into one incident by labels (comma-separated)">
          <Input
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            placeholder="service, env"
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">From sources</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {sources.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={sourceIds.includes(s.id)}
                onChange={(e) =>
                  setSourceIds(
                    e.target.checked ? [...sourceIds, s.id] : sourceIds.filter((x) => x !== s.id),
                  )
                }
              />
              {s.name}
            </label>
          ))}
          <span className="text-xs text-subtle">
            {sourceIds.length ? '' : 'None selected: every source'}
          </span>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">When all of these match</legend>
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div key={i} className="grid items-center gap-2 md:grid-cols-[14rem_11rem_1fr_auto]">
              <Input
                aria-label="Field"
                value={c.field}
                onChange={(e) => setCond(i, { field: e.target.value })}
                placeholder="label.env"
              />
              <Select
                aria-label="Operator"
                value={c.op}
                onChange={(e) => setCond(i, { op: e.target.value as AlertCondition['op'] })}
              >
                {ALERT_CONDITION_OPS.map((op) => (
                  <option key={op} value={op}>
                    {OP_LABEL[op]}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Value"
                disabled={c.op === 'exists' || c.op === 'not_exists'}
                value={c.value ?? ''}
                onChange={(e) => setCond(i, { value: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConditions([...conditions, blankCondition()])}
          >
            Add condition
          </Button>
          <p className="text-xs text-subtle">
            Fields: title, description, severity, status, or label.&lt;name&gt; (for example
            label.service).
          </p>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createIncident}
            onChange={(e) => setCreateIncident(e.target.checked)}
          />
          Open an incident (otherwise alerts are only recorded)
        </label>
        <Field label="Incident severity">
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | '')}>
            <option value="">From the alert</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={create.isPending}>
          Create route
        </Button>
      </div>
      <ErrorBox error={create.error} />
    </form>
  );
}

function Preview({ ws, sources }: { ws: string; sources: AlertSource[] }) {
  const preview = usePreviewAlert(ws);
  const usable = sources.filter((s) => s.kind !== 'heartbeat');
  const [sourceId, setSourceId] = useState(usable[0]?.id ?? '');
  const [payload, setPayload] = useState(
    '{\n  "title": "Checkout error rate above 5%",\n  "severity": "critical",\n  "metadata": { "service": "checkout", "env": "production" }\n}',
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const r: AlertPreview | undefined = preview.data;
  if (!usable.length) return null;
  return (
    <Card className="mt-6 p-4">
      <p className="text-sm font-medium">Test a payload</p>
      <p className="mb-3 text-xs text-subtle">
        Shows which route each alert takes. Nothing is stored.
      </p>
      <div className="mb-2 w-72">
        <Select aria-label="Source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {usable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({ALERT_SOURCE_LABELS[s.kind]})
            </option>
          ))}
        </Select>
      </div>
      <textarea
        aria-label="Payload JSON"
        className="h-36 w-full rounded-md border border-line bg-surface p-3 font-mono text-xs"
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
      />
      <Button
        className="mt-2"
        variant="secondary"
        disabled={preview.isPending}
        onClick={() => {
          try {
            setParseError(null);
            preview.mutate({ sourceId, payload: JSON.parse(payload) as unknown });
          } catch {
            setParseError('Not valid JSON');
          }
        }}
      >
        Preview routing
      </Button>
      {(parseError || r?.error) && (
        <p className="mt-2 text-sm text-danger">{parseError ?? r?.error}</p>
      )}
      {r && !r.error && (
        <ul className="mt-3 space-y-1 text-sm">
          {r.alerts.map((a, i) => (
            <li key={i}>
              <Badge tone={a.severity}>{a.severity}</Badge> {a.title} →{' '}
              {a.route ? (
                <>
                  <strong>{a.route.name}</strong>
                  <span className="text-subtle">
                    {' '}
                    · {a.createsIncident ? `incident group ${a.groupKey}` : 'recorded only'}
                  </span>
                </>
              ) : (
                <span className="text-warn">no route matches</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Routes({ ws, isAdmin }: { ws: string; isAdmin: boolean }) {
  const routes = useAlertRoutes(ws);
  const sources = useAlertSources(ws);
  const update = useUpdateAlertRoute(ws);
  const remove = useDeleteAlertRoute(ws);
  const reorder = useReorderAlertRoutes(ws);
  const [adding, setAdding] = useState(false);
  const all = routes.data ?? [];
  const sourceName = (id: string) =>
    sources.data?.find((s) => s.id === id)?.name ?? 'removed source';
  const move = (i: number, d: -1 | 1) => {
    const ids = all.map((r) => r.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    reorder.mutate(ids);
  };
  const describe = (r: AlertRoute) =>
    [
      r.sourceIds.length ? `from ${r.sourceIds.map(sourceName).join(', ')}` : 'from any source',
      r.conditions.length
        ? `when ${r.conditions.map((c) => `${c.field} ${OP_LABEL[c.op]}${c.value !== undefined && !c.op.includes('exists') ? ` "${c.value}"` : ''}`).join(' and ')}`
        : 'for every alert',
      r.createIncident
        ? `→ incident${r.groupBy.length ? ` per ${r.groupBy.join(' + ')}` : ' per alert'}${r.incidentSeverity ? ` (${r.incidentSeverity})` : ''}`
        : '→ record only',
    ].join(' · ');

  return (
    <>
      <p className="mb-3 text-sm text-subtle">
        Routes are checked top to bottom. The first enabled route that matches decides what happens.
      </p>
      <Card>
        {routes.isPending ? (
          <Loading />
        ) : !all.length ? (
          <EmptyState
            title="No routes"
            hint="Without a route, alerts are recorded but open no incident."
          />
        ) : (
          <ol className="divide-y divide-line">
            {all.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="w-6 text-sm text-subtle">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.name} {!r.enabled && <Badge tone="disconnected">paused</Badge>}
                  </p>
                  <p className="text-xs text-subtle">{describe(r)}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      aria-label={`Move ${r.name} up`}
                      disabled={i === 0 || reorder.isPending}
                      onClick={() => move(i, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Move ${r.name} down`}
                      disabled={i === all.length - 1 || reorder.isPending}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => update.mutate({ id: r.id, enabled: !r.enabled })}
                    >
                      {r.enabled ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        if (confirm(`Delete the route “${r.name}”?`)) remove.mutate(r.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {isAdmin &&
          (adding ? (
            <RouteForm ws={ws} sources={sources.data ?? []} onDone={() => setAdding(false)} />
          ) : (
            <div className="border-t border-line p-4">
              <Button onClick={() => setAdding(true)}>New route</Button>
            </div>
          ))}
      </Card>
      <div className="mt-2">
        <ErrorBox error={update.error ?? remove.error ?? reorder.error} />
      </div>
      {isAdmin && sources.data && <Preview ws={ws} sources={sources.data} />}
    </>
  );
}

export default function AlertsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  const [tab, setTab] = useState<Tab>('alerts');
  const isAdmin = atLeast(ws.data?.role, 'admin');
  const tabs: [Tab, string][] = [
    ['alerts', 'Alerts'],
    ['sources', 'Sources'],
    ['routes', 'Routes'],
  ];
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Alerts"
        description="Alerts from your monitoring tools, and the routes that turn them into incidents."
      />
      <div role="tablist" aria-label="Alerts" className="mb-4 flex gap-1 border-b border-line">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === id
                ? 'border-accent font-medium text-fg'
                : 'border-transparent text-subtle hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'alerts' && <AlertList ws={workspaceId} />}
      {tab === 'sources' && <Sources ws={workspaceId} isAdmin={isAdmin} />}
      {tab === 'routes' && <Routes ws={workspaceId} isAdmin={isAdmin} />}
    </div>
  );
}
