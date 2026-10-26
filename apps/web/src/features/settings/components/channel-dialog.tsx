'use client';

import {
  createNotificationChannelSchema,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENTS,
  SEVERITIES,
  updateNotificationChannelSchema,
  type CreateNotificationChannelInput,
  type NotificationChannel,
  type NotificationChannelWithSecret,
  type UpdateNotificationChannelInput,
} from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

type ChannelDialogProps = {
  channel: NotificationChannel | null;
  base: string;
  onClose: () => void;
  onSaved: (created: NotificationChannelWithSecret | null) => void;
};

type CommonFields = { events: string[]; minSeverity: string };

const EVENTS_ERROR = 'Pick at least one event.';

function EventsFieldset({
  register,
  error,
}: {
  register: UseFormRegister<CommonFields>;
  error?: string;
}) {
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="mb-1.5 text-[13px] font-semibold">Send a message when</legend>
      {NOTIFICATION_EVENTS.map((ev) => (
        <label key={ev} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            value={ev}
            className="mt-0.5 size-4 accent-brand"
            {...register('events')}
          />
          {NOTIFICATION_EVENT_LABELS[ev]}
        </label>
      ))}
      {error && (
        <span role="alert" className="text-[13px] text-danger">
          {EVENTS_ERROR}
        </span>
      )}
    </fieldset>
  );
}

function SeverityField({ register }: { register: UseFormRegister<CommonFields> }) {
  return (
    <Field id="channel-severity" label="Only for incidents at least this serious">
      <Select id="channel-severity" {...register('minSeverity')}>
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {s === 'low' ? 'low (everything)' : s}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function DialogActions({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

export function ChannelDialog({ channel, base, onClose, onSaved }: ChannelDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: CreateNotificationChannelInput | UpdateNotificationChannelInput) =>
      channel
        ? api<NotificationChannel>(`${base}/${channel.id}`, { method: 'PATCH', json: body }).then(
            () => null,
          )
        : api<NotificationChannelWithSecret>(base, { method: 'POST', json: body }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = (body: CreateNotificationChannelInput | UpdateNotificationChannelInput) => {
    setError(null);
    save.mutate(body);
  };
  const actions = (
    <>
      <FormError>{error}</FormError>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <DialogActions pending={save.isPending} label={channel ? 'Save changes' : 'Add channel'} />
      </div>
    </>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={channel ? `Edit ${channel.name}` : 'Add a notification channel'}
      description="We post here when one of the chosen events happens to an incident at or above the severity you pick."
      wide
    >
      {channel ? (
        <EditForm channel={channel} onSubmit={submit}>
          {actions}
        </EditForm>
      ) : (
        <CreateForm onSubmit={submit}>{actions}</CreateForm>
      )}
    </Dialog>
  );
}

type FormProps = {
  onSubmit: (body: CreateNotificationChannelInput | UpdateNotificationChannelInput) => void;
  children: React.ReactNode;
};

function EditForm({ channel, onSubmit, children }: FormProps & { channel: NotificationChannel }) {
  const form = useZodForm(updateNotificationChannelSchema, {
    defaultValues: { name: channel.name, events: channel.events, minSeverity: channel.minSeverity },
  });
  const { errors } = form.formState;
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <Field id="channel-name" label="Name" error={errors.name?.message}>
        <Input
          id="channel-name"
          maxLength={80}
          invalid={Boolean(errors.name)}
          {...form.register('name')}
        />
      </Field>
      <EventsFieldset
        register={form.register as unknown as UseFormRegister<CommonFields>}
        error={errors.events?.message}
      />
      <SeverityField register={form.register as unknown as UseFormRegister<CommonFields>} />
      <p className="m-0 text-[13px] text-ink-muted">
        To change the URL, delete this channel and add it again.
      </p>
      {children}
    </form>
  );
}

function CreateForm({ onSubmit, children }: FormProps) {
  const form = useZodForm(createNotificationChannelSchema, {
    defaultValues: {
      kind: 'slack',
      name: '',
      webhookUrl: '',
      events: [...NOTIFICATION_EVENTS],
      minSeverity: 'low',
    },
  });
  const kind = form.watch('kind');
  const { errors } = form.formState;
  const urlField = kind === 'slack' ? 'webhookUrl' : 'url';
  const urlError =
    kind === 'slack'
      ? (errors as { webhookUrl?: { message?: string } }).webhookUrl?.message
      : (errors as { url?: { message?: string } }).url?.message;
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <Field id="channel-kind" label="Type">
        <Select id="channel-kind" {...form.register('kind')}>
          <option value="slack">Slack incoming webhook</option>
          <option value="webhook">Webhook (your HTTPS endpoint, signed)</option>
        </Select>
      </Field>
      <Field id="channel-name" label="Name" error={errors.name?.message}>
        <Input
          id="channel-name"
          maxLength={80}
          invalid={Boolean(errors.name)}
          placeholder={kind === 'slack' ? '#incidents' : 'PagerDuty bridge'}
          {...form.register('name')}
        />
      </Field>
      <Field
        id="channel-url"
        label={kind === 'slack' ? 'Slack webhook URL' : 'Endpoint URL'}
        error={urlError}
        hint={
          kind === 'slack'
            ? 'From a Slack app with Incoming Webhooks: https://hooks.slack.com/services/…'
            : 'We POST JSON signed with a secret you get after saving.'
        }
      >
        <Input
          key={urlField}
          id="channel-url"
          type="url"
          maxLength={500}
          invalid={Boolean(urlError)}
          placeholder={
            kind === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://example.com/hook'
          }
          {...form.register(urlField as 'webhookUrl')}
        />
      </Field>
      <EventsFieldset
        register={form.register as unknown as UseFormRegister<CommonFields>}
        error={errors.events?.message}
      />
      <SeverityField register={form.register as unknown as UseFormRegister<CommonFields>} />
      {children}
    </form>
  );
}
