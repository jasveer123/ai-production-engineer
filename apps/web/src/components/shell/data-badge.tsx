'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/features/auth/session';
import { isLiveRoute } from './nav-config';

/** Says plainly which pages still show sample data while they are being wired to the API. */
export function DataBadge() {
  const pathname = usePathname();
  const { me } = useSession();
  if (isLiveRoute(pathname)) {
    return me.user.emailVerified ? null : (
      <Link
        href="/account/"
        className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn max-md:hidden"
      >
        Confirm your email
      </Link>
    );
  }
  return (
    <span
      className="rounded-full bg-spark-soft px-2.5 py-1 text-xs font-semibold text-spark-ink max-md:hidden"
      title="This page is not connected to your workspace data yet"
    >
      Sample data on this page
    </span>
  );
}
