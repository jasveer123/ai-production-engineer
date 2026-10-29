'use client';

import { resetPasswordSchema, type Me } from '@ape/api-contracts';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form';
import { AuthHeading } from '@/features/auth/components/auth-heading';
import { PasswordField } from '@/features/auth/components/password-field';
import { ME_KEY } from '@/features/auth/session';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { api } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

function ResetForm() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const qc = useQueryClient();
  const { pending, error, fieldErrors, run } = useAuthAction();

  const form = useZodForm(resetPasswordSchema.pick({ password: true }), {
    defaultValues: { password: '' },
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    const me = await run(() =>
      api<Me>('/auth/reset-password', { method: 'POST', json: { token, password } }),
    );
    if (!me) return;
    qc.clear();
    qc.setQueryData(ME_KEY, me);
    router.replace(me.workspaces.length ? '/' : '/onboarding/');
  });

  if (!token)
    return (
      <>
        <AuthHeading title="Link is missing">
          Open the link from the email again, or ask for a new one.
        </AuthHeading>
        <Link href="/forgot-password/" className="text-sm font-semibold text-brand hover:underline">
          Send a new link
        </Link>
      </>
    );

  return (
    <>
      <AuthHeading title="Choose a new password">
        You will be signed out everywhere else.
      </AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          showRules
          error={form.formState.errors.password?.message ?? fieldErrors.password}
          registration={form.register('password')}
        />
        <FormError>
          {error}
          {error && (
            <>
              {' '}
              <Link href="/forgot-password/" className="underline">
                Send a new link
              </Link>
            </>
          )}
        </FormError>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Set password and sign in'}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
