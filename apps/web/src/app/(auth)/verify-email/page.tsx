'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AuthHeading } from '@/features/auth/components/auth-heading';
import { api, errorMessage } from '@/lib/api';

function Verify() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<{ status: 'working' | 'done' | 'error'; message?: string }>({
    status: 'working',
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) return setState({ status: 'error', message: 'The link is missing its token.' });
    api('/auth/verify-email', { method: 'POST', json: { token } })
      .then(() => setState({ status: 'done' }))
      .catch((err: unknown) => setState({ status: 'error', message: errorMessage(err) }));
  }, [token]);

  if (state.status === 'working') return <AuthHeading title="Confirming your email…" />;
  if (state.status === 'error')
    return (
      <>
        <AuthHeading title="We could not confirm your email">{state.message}</AuthHeading>
        <Link href="/account/" className="text-sm font-semibold text-brand hover:underline">
          Send a new link from your account page
        </Link>
      </>
    );
  return (
    <>
      <AuthHeading title="Email confirmed">
        Thanks. Any invitations sent to this address are now in your account.
      </AuthHeading>
      <Link href="/" className="text-sm font-semibold text-brand hover:underline">
        Continue
      </Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
