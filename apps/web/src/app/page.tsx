'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/queries';

/** Sends the user to login, to workspace creation, or into their first workspace. */
export default function Home() {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
    else if (me.data) {
      const first = me.data.workspaces[0];
      router.replace(first ? `/w/${first.id}` : '/workspaces/new');
    }
  }, [me.data, me.error, router]);

  return <Loading />;
}
