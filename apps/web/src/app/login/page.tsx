'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { devLoginSchema, type DevLoginInput } from '@ape/api-contracts';
import { Button, Card, ErrorBox, Field, Input, Loading } from '@/components/ui';
import { api, apiUrl } from '@/lib/api';
import { keys, useProviders } from '@/lib/queries';

const DEMO_USERS = [
  { email: 'owner@demo.local', label: 'Owner' },
  { email: 'engineer@demo.local', label: 'Engineer' },
  { email: 'viewer@demo.local', label: 'Viewer' },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const providers = useProviders();
  const form = useForm<DevLoginInput>({ resolver: zodResolver(devLoginSchema) });

  const login = async (values: DevLoginInput) => {
    try {
      await api('/auth/dev-login', { method: 'POST', body: JSON.stringify(values) });
      qc.removeQueries();
      router.replace('/');
    } catch (err) {
      form.setError('root', { message: err instanceof Error ? err.message : 'Login failed' });
    }
  };

  if (providers.isPending) return <Loading />;
  const p = providers.data;

  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-subtle">AI Production Engineer</p>

      {params.get('error') === 'github' && (
        <div className="mt-4">
          <ErrorBox error={new Error('GitHub sign-in failed. Try again.')} />
        </div>
      )}
      <ErrorBox error={providers.error} />

      {p?.github && (
        <a href={apiUrl('/auth/github')} className="mt-6 block">
          <Button className="w-full">Continue with GitHub</Button>
        </a>
      )}

      {p?.devLogin && (
        <form onSubmit={form.handleSubmit(login)} className="mt-6 flex flex-col gap-4">
          <p className="rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">
            Dev login is on. It is for local development only.
          </p>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.register('email')}
            />
          </Field>
          {form.formState.errors.root && (
            <ErrorBox error={new Error(form.formState.errors.root.message)} />
          )}
          <Button
            type="submit"
            variant={p.github ? 'secondary' : 'primary'}
            disabled={form.formState.isSubmitting}
          >
            Sign in with email
          </Button>
          <div>
            <p className="mb-2 text-xs text-subtle">Seeded demo users</p>
            <div className="flex gap-2">
              {DEMO_USERS.map((u) => (
                <Button
                  key={u.email}
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void login({ email: u.email })}
                >
                  {u.label}
                </Button>
              ))}
            </div>
          </div>
        </form>
      )}

      {p && !p.github && !p.devLogin && (
        <p className="mt-6 text-sm text-subtle">
          No sign-in method is configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET
          for the API.
        </p>
      )}
    </Card>
  );
}

export default function LoginPage() {
  // Invalidate any cached user so a fresh login is always fetched.
  const qc = useQueryClient();
  qc.removeQueries({ queryKey: keys.me });
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<Loading />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
