'use client';

import { registerSchema, type InvitationPreview, type Me } from '@ape/api-contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';
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

  const form = useZodForm(registerSchema, {
    defaultValues: { name: '', email: '', password: '' },
    values: preview.data ? { name: '', email: preview.data.email, password: '' } : undefined,
    resetOptions: { keepDirtyValues: true },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    const me = await run(() =>
      api<Me>('/auth/register', {
        method: 'POST',
        json: { ...values, ...(invite ? { inviteToken: invite } : {}) },
      }),
    );
    if (!me) return;
    qc.clear();
    qc.setQueryData(ME_KEY, me);
    router.replace(me.workspaces.length ? next : '/onboarding/');
  });

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
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field id="name" label="Your name" error={errors.name?.message ?? fieldErrors.name}>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            maxLength={100}
            invalid={Boolean(errors.name ?? fieldErrors.name)}
            {...form.register('name')}
          />
        </Field>
        <Field
          id="email"
          label="Work email"
          error={errors.email?.message ?? fieldErrors.email}
          hint={preview.data ? 'Set by the invitation.' : undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            readOnly={Boolean(preview.data)}
            invalid={Boolean(errors.email ?? fieldErrors.email)}
            {...form.register('email')}
          />
        </Field>
        <PasswordField
          id="password"
          autoComplete="new-password"
          showRules
          error={errors.password?.message ?? fieldErrors.password}
          registration={form.register('password')}
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
