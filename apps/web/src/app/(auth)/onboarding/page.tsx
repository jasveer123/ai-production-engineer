'use client';

import Link from 'next/link';
import type { Me, Workspace } from '@ape/api-contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { AuthHeading } from '@/features/auth/components/auth-heading';
import { ME_KEY } from '@/features/auth/session';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { api, ApiError } from '@/lib/api';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ME_KEY, queryFn: () => api<Me>('/auth/me') });
  const { pending, error, fieldErrors, run } = useAuthAction();

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      router.replace('/login/?next=/onboarding/');
  }, [me.error, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get('name');
    const ws = await run(() => api<Workspace>('/workspaces', { method: 'POST', json: { name } }));
    if (!ws) return;
    try {
      localStorage.setItem('ape.workspace', ws.id);
    } catch {
      // ignore
    }
    await qc.invalidateQueries({ queryKey: ME_KEY });
    router.replace('/integrations/');
  }

  return (
    <>
      <AuthHeading title="Create your workspace">
        {me.data ? `Hi ${me.data.user.name ?? me.data.user.email}. ` : ''}A workspace holds your
        services, incidents and team. You will be its owner.
      </AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field
          id="name"
          label="Workspace name"
          error={fieldErrors.name}
          hint="Usually your company or team, e.g. Jasveer Shop."
        >
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoFocus
            invalid={Boolean(fieldErrors.name)}
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
