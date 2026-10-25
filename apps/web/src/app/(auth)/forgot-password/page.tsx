'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { AuthHeading } from '@/features/auth/components/auth-heading';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const { pending, error, run } = useAuthAction();
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email'));
    const done = await run(() =>
      api('/auth/forgot-password', { method: 'POST', json: { email } }).then(() => true),
    );
    if (done) setSentTo(email);
  }

  if (sentTo)
    return (
      <>
        <AuthHeading title="Check your email">
          If an account exists for {sentTo}, we sent a link to reset the password. It works once and
          expires in 30 minutes.
        </AuthHeading>
        <Link href="/login/" className="text-sm font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      </>
    );

  return (
    <>
      <AuthHeading title="Reset your password">
        Enter your email and we will send you a link.
      </AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="m-0 mt-6 text-center text-sm">
        <Link href="/login/" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
