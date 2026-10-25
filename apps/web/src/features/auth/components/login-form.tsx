'use client';

import { loginSchema, type Me } from '@ape/api-contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { api, apiUrl } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';
import { safeNext } from '../roles';
import { ME_KEY } from '../session';
import { useAuthAction } from '../use-auth-action';
import { AuthHeading } from './auth-heading';
import { PasswordField } from './password-field';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = safeNext(params.get('next'));
  const { pending, error, fieldErrors, run } = useAuthAction();
  const providers = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => api<Me['authProviders']>('/auth/providers'),
    staleTime: Infinity,
  });

  const form = useZodForm(loginSchema, { defaultValues: { email: '', password: '' } });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    const me = await run(() => api<Me>('/auth/login', { method: 'POST', json: values }));
    if (!me) return;
    qc.clear();
    qc.setQueryData(ME_KEY, me);
    router.replace(me.workspaces.length ? next : '/onboarding/');
  });

  async function devLogin(email: string) {
    const ok = await run(() => api('/auth/dev-login', { method: 'POST', json: { email } }));
    if (ok === undefined) {
      qc.clear();
      router.replace(next);
    }
  }

  return (
    <>
      <AuthHeading title="Sign in">Welcome back. Use the email you registered with.</AuthHeading>
      {params.get('error') === 'github' && (
        <FormError>GitHub sign-in did not finish. Try again.</FormError>
      )}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field id="email" label="Email" error={errors.email?.message ?? fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            invalid={Boolean(errors.email ?? fieldErrors.email)}
            {...form.register('email')}
          />
        </Field>
        <PasswordField
          id="password"
          autoComplete="current-password"
          error={errors.password?.message ?? fieldErrors.password}
          registration={form.register('password')}
        />
        <div className="-mt-2 text-right text-[13px]">
          <Link href="/forgot-password/" className="text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {providers.data?.github && (
        <>
          <div className="my-5 flex items-center gap-3 text-[13px] text-ink-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <a
            href={apiUrl('/auth/github')}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-surface-hover text-sm font-semibold hover:bg-line"
          >
            Continue with GitHub
          </a>
        </>
      )}

      {providers.data?.devLogin && (
        <details className="mt-5 rounded-md border border-dashed border-line-strong p-3 text-[13px]">
          <summary className="cursor-pointer font-semibold text-ink-muted">
            Local demo users
          </summary>
          <p className="m-0 mt-2 text-ink-muted">
            Development only. The seed gives them the password <code>demo-shop-2026</code>, or sign
            in with one click:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['owner', 'engineer', 'viewer'].map((r) => (
              <Button
                key={r}
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => void devLogin(`${r}@demo.local`)}
              >
                {r}
              </Button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get('devEmail') ?? '').trim();
              if (email) void devLogin(email);
            }}
          >
            <label htmlFor="devEmail" className="sr-only">
              Any local account email
            </label>
            <Input
              id="devEmail"
              name="devEmail"
              type="email"
              placeholder="any local account, e.g. jasveer@shop.local"
              className="h-8 text-[13px]"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Sign in
            </Button>
          </form>
        </details>
      )}

      <p className="m-0 mt-6 text-center text-sm text-ink-muted">
        New here?{' '}
        <Link
          href={`/register/${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-semibold text-brand hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
