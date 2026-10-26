'use client';

import Link from 'next/link';
import { createWorkspaceSchema, type Workspace } from '@ape/api-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { AuthHeading } from '@/features/auth/components/auth-heading';
import { ME_KEY, useMe } from '@/features/auth/session';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { api, ApiError } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const { pending, error, fieldErrors, run } = useAuthAction();

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      router.replace('/login/?next=/onboarding/');
  }, [me.error, router]);

  const form = useZodForm(createWorkspaceSchema, { defaultValues: { name: '' } });
  const nameError = form.formState.errors.name?.message ?? fieldErrors.name;

  const onSubmit = form.handleSubmit(async (values) => {
    const ws = await run(() => api<Workspace>('/workspaces', { method: 'POST', json: values }));
    if (!ws) return;
    try {
      localStorage.setItem('ape.workspace', ws.id);
    } catch {
      // ignore
    }
    await qc.invalidateQueries({ queryKey: ME_KEY });
    router.replace('/integrations/');
  });

  return (
    <>
      <AuthHeading title="Create your workspace">
        {me.data ? `Hi ${me.data.user.name ?? me.data.user.email}. ` : ''}A workspace holds your
        services, incidents and team. You will be its owner.
      </AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field
          id="name"
          label="Workspace name"
          error={nameError}
          hint="Usually your company or team, e.g. Jasveer Shop."
        >
          <Input
            id="name"
            maxLength={80}
            autoFocus
            invalid={Boolean(nameError)}
            {...form.register('name')}
          />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create workspace'}
        </Button>
      </form>
      {me.data && me.data.workspaces.length > 0 && (
        <p className="m-0 mt-4 text-center text-[13px]">
          <Link href="/" className="text-brand hover:underline">
            Back to {me.data.workspaces[0]!.name}
          </Link>
        </p>
      )}
    </>
  );
}
