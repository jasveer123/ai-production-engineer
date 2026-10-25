'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { PasswordField } from '@/features/auth/components/password-field';
import { ROLE_LABEL } from '@/features/auth/roles';
import { ME_KEY, useSession } from '@/features/auth/session';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { api, errorMessage } from '@/lib/api';

export function AccountView() {
  const { me } = useSession();
  const qc = useQueryClient();
  const profile = useAuthAction();
  const password = useAuthAction();
  const [saved, setSaved] = useState<string | null>(null);
  const resend = useMutation({
    mutationFn: () => api('/auth/resend-verification', { method: 'POST' }),
  });

  return (
    <>
      <PageHeader
        title="Your account"
        description="Your profile, password and the workspaces you belong to."
      />
      {!me.user.emailVerified && (
        <Banner tone="info" title={`Confirm ${me.user.email}.`}>
          Open the link we emailed you. Invitations to this address apply once it is confirmed.{' '}
          <button
            className="text-brand underline underline-offset-[3px]"
            disabled={resend.isPending || resend.isSuccess}
            onClick={() => resend.mutate()}
          >
            {resend.isSuccess ? 'Sent again' : 'Send it again'}
          </button>
          {resend.isError && <span className="text-danger"> {errorMessage(resend.error)}</span>}
        </Banner>
      )}
      {saved && <Banner tone="ok" title={saved} />}

      <Card as="section" className="grid gap-4">
        <CardHeader eyebrow="Profile" title="Name and email" />
        <form
          className="grid max-w-[420px] gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name');
            const next = await profile.run(() =>
              api('/auth/me', { method: 'PATCH', json: { name } }),
            );
            if (next) {
              qc.setQueryData(ME_KEY, next);
              setSaved('Profile saved.');
            }
          }}
        >
          <Field id="name" label="Name" error={profile.fieldErrors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={me.user.name ?? ''}
              required
              maxLength={100}
            />
          </Field>
          <Field id="email" label="Email" hint="Email changes are not supported yet.">
            <Input id="email" value={me.user.email} readOnly disabled />
          </Field>
          <FormError>{profile.error}</FormError>
          <div>
            <Button type="submit" disabled={profile.pending}>
              {profile.pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>

      <Card as="section" className="grid gap-4">
        <CardHeader
          eyebrow="Security"
          title={me.user.hasPassword ? 'Change password' : 'Set a password'}
        />
        <form
          className="grid max-w-[420px] gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const ok = await password.run(() =>
              api('/auth/change-password', {
                method: 'POST',
                json: { currentPassword: f.get('current') || undefined, newPassword: f.get('new') },
              }).then(() => true),
            );
            if (ok) {
              form.reset();
              setSaved('Password changed. Your other sessions were signed out.');
              void qc.invalidateQueries({ queryKey: ME_KEY });
            }
          }}
        >
          {me.user.hasPassword && (
            <PasswordField id="current" label="Current password" autoComplete="current-password" />
          )}
          <PasswordField
            id="new"
            label="New password"
            autoComplete="new-password"
            showRules
            error={password.fieldErrors.newPassword}
          />
          <FormError>{password.error}</FormError>
          <div>
            <Button type="submit" disabled={password.pending}>
              {password.pending ? 'Saving…' : 'Save password'}
            </Button>
          </div>
        </form>
      </Card>

      <Card as="section">
        <CardHeader eyebrow="Workspaces" title="Where you are a member" />
        <ul className="m-0 mt-3 grid list-none gap-2 p-0">
          {me.workspaces.map((w) => (
            <li
              key={w.id}
              className="flex justify-between border-t border-line pt-2 first:border-t-0 first:pt-0"
            >
              <span>{w.name}</span>
              <span className="text-ink-muted">{ROLE_LABEL[w.role]}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
