'use client';

import type { InvitationPreview, Me } from '@ape/api-contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormError } from '@/components/ui/form';
import { AuthHeading } from '@/features/auth/components/auth-heading';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { api, ApiError } from '@/lib/api';

function Invite() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const { pending, error, run } = useAuthAction();
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  });
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api<Me>('/auth/me'),
    retry: false,
  });
  const here = `/invite/?token=${encodeURIComponent(token)}`;

  async function accept() {
    const res = await run(() =>
      api<{ workspaceId: string }>(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      }),
    );
    if (!res) return;
    try {
      localStorage.setItem('ape.workspace', res.workspaceId);
    } catch {}
    qc.clear();
    router.replace('/');
  }

  if (!token || preview.isError)
    return (
      <AuthHeading title="This invitation is not valid">
        It may have expired or been used already. Ask the person who invited you for a new link.
      </AuthHeading>
    );
  if (!preview.data || me.isPending) return <AuthHeading title="Loading invitation…" />;

  const p = preview.data;
  const signedIn = me.data && !(me.error instanceof ApiError);
  const sameEmail = signedIn && me.data!.user.email.toLowerCase() === p.email.toLowerCase();

  return (
    <>
      <AuthHeading title={`Join ${p.workspaceName}`}>
        {p.invitedBy ? `${p.invitedBy} invited ` : 'You were invited '}
        {p.email} as <b>{ROLE_LABEL[p.role]}</b>.
      </AuthHeading>
      <FormError>{error}</FormError>
      {sameEmail ? (
        <Button onClick={() => void accept()} disabled={pending} className="w-full">
          {pending ? 'Joining…' : 'Accept invitation'}
        </Button>
      ) : signedIn ? (
        <FormError>
          You are signed in as {me.data!.user.email}. Sign out and sign in as {p.email} to accept.
        </FormError>
      ) : p.accountExists ? (
        <ButtonLink href={`/login/?next=${encodeURIComponent(here)}`} className="w-full">
          Sign in to accept
        </ButtonLink>
      ) : (
        <ButtonLink href={`/register/?invite=${encodeURIComponent(token)}`} className="w-full">
          Create account and join
        </ButtonLink>
      )}
      <p className="m-0 mt-6 text-center text-[13px] text-ink-muted">
        Not you?{' '}
        <Link href="/" className="text-brand hover:underline">
          Go to the app
        </Link>
      </p>
    </>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <Invite />
    </Suspense>
  );
}
