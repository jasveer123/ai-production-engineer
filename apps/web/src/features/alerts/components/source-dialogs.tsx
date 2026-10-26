'use client';

import {
  ALERT_SOURCE_KINDS,
  ALERT_SOURCE_LABELS,
  type AlertSourceKind,
  type AlertSourceWithToken,
  type CreateAlertSourceInput,
} from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CodeSnippet, TokenField } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { setupSnippet } from '../setup';

export function CreateSourceDialog({
  heartbeat,
  workspaceId,
  onClose,
  onCreated,
}: {
  heartbeat: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: (s: AlertSourceWithToken) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: CreateAlertSourceInput) =>
      api<AlertSourceWithToken>(`/workspaces/${workspaceId}/alert-sources`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: onCreated,
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={heartbeat ? 'Add a heartbeat' : 'Add an alert source'}
      description={
        heartbeat
          ? 'For cron jobs and workers: if a ping does not arrive in time, an alert fires.'
          : 'You get a URL and token to paste into the tool. The token is shown once.'
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const name = String(f.get('name')).trim();
          create.mutate(
            heartbeat
              ? {
                  kind: 'heartbeat',
                  name,
                  intervalSeconds: Number(f.get('interval')) * 60,
                  graceSeconds: Number(f.get('grace')) * 60,
                }
              : { kind: String(f.get('kind')) as Exclude<AlertSourceKind, 'heartbeat'>, name },
          );
        }}
      >
        {!heartbeat && (
          <Field id="source-kind" label="Tool">
            <Select id="source-kind" name="kind" defaultValue="http">
              {ALERT_SOURCE_KINDS.filter((k) => k !== 'heartbeat').map((k) => (
                <option key={k} value={k}>
                  {ALERT_SOURCE_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field id="source-name" label="Name">
          <Input
            id="source-name"
            name="name"
            required
            maxLength={80}
            placeholder={heartbeat ? 'nightly-billing-job' : 'Production Alertmanager'}
          />
        </Field>
        {heartbeat && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="beat-interval" label="Expect a ping every (minutes)">
              <Input
                id="beat-interval"
                name="interval"
                type="number"
                required
                min={1}
                max={10080}
                defaultValue={60}
              />
            </Field>
            <Field id="beat-grace" label="Grace (minutes)">
              <Input
                id="beat-grace"
                name="grace"
                type="number"
                required
                min={0}
                max={1440}
                defaultValue={5}
              />
            </Field>
          </div>
        )}
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The token exists only in this response, so this is the one chance to copy it. */
export function RevealDialog({
  source,
  onClose,
}: {
  source: AlertSourceWithToken;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={`Set up ${source.name}`}
      description="Copy the token now. It is shown only once; rotate it if it is lost."
    >
      <div className="grid gap-4">
        <TokenField
          label="Token"
          masked={source.token}
          full={source.token}
          help="Send it as Authorization: Bearer, an X-Ape-Token header, or ?token=."
        />
        <TokenField
          label="URL"
          masked={source.url}
          full={source.url}
          help="Where the tool sends alerts."
        />
        <CodeSnippet
          label={ALERT_SOURCE_LABELS[source.kind]}
          code={setupSnippet(source.kind, source.url, source.token)}
          wrap
        />
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}
