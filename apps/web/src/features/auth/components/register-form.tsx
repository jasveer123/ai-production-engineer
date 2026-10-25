'use client';

import type { InvitationPreview, Me } from '@ape/api-contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { ROLE_LABEL, safeNext } from '../roles';
import { ME_KEY } from '../session';
import { useAuthAction } from '../use-auth-action';
import { AuthHeading } from './auth-heading';
import { PasswordField } from './password-field';

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const invite = params.get('invite');
  const next = safeNext(params.get('next'));
  const { pending, error, fieldErrors, run } = useAuthAction();
  const preview = useQuery({
    queryKey: ['invite', invite],
    queryFn: () => api<InvitationPreview>(`/auth/invitations/${encodeURIComponent(invite!)}`),
    enabled: Boolean(invite),
    retry: false,
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const me = await run(() =>
      api<Me>('/auth/register', {
        method: 'POST',
        json: {
          name: form.get('name'),
          email: preview.data?.email ?? form.get('email'),
          password: form.get('password'),
          ...(invite ? { inviteToken: invite } : {}),
        },
      }),
    );
    if (!me) return;
    qc.clear();
    qc.setQueryData(ME_KEY, me);
    router.replace(me.workspaces.length ? next : '/onboarding/');
  }

  return (
    <>
      <AuthHeading title="Create your account">
        {preview.data
          ? `Join ${preview.data.workspaceName} as ${ROLE_LABEL[preview.data.role].toLowerCase()}.`
          : 'Start free. You can invite your team after.'}
      </AuthHeading>
      {invite && preview.isError && (
        <FormError>This invitation link is invalid or has expired. Ask for a new one.</FormError>
      )}
      {preview.data?.accountExists && (
        <FormError>
          An account with {preview.data.email} already exists.{' '}
          <Link className="underline" href={`/invite/?token=${encodeURIComponent(invite!)}`}>
            Sign in to accept
          </Link>
          .
        </FormError>
      )}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field id="name" label="Your name" error={fieldErrors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            autoFocus
            maxLength={100}
            invalid={Boolean(fieldErrors.name)}
          />
        </Field>
        <Field
          id="email"
          label="Work email"
          error={fieldErrors.email}
          hint={preview.data ? 'Set by the invitation.' : undefined}
        >
          <Input
            key={preview.data?.email ?? 'open'}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={preview.data?.email}
            readOnly={Boolean(preview.data)}
            invalid={Boolean(fieldErrors.email)}
          />
        </Field>
        <PasswordField
          id="password"
          autoComplete="new-password"
          showRules
          error={fieldErrors.password}
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending || (Boolean(invite) && !preview.data)}>
          {pending
            ? 'Creating account…'
            : preview.data
              ? 'Create account and join'
              : 'Create account'}
        </Button>
      </form>
      <p className="m-0 mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login/" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
