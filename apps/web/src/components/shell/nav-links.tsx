'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { isActive, type NavItem } from './nav-config';

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-0.5">
      {items.map((item) => {
        const active =
          isActive(item.href, pathname) &&
          !items.some((o) => o.href.length > item.href.length && isActive(o.href, pathname));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-[8px] px-3 py-[7px] text-sm font-semibold leading-5',
                active
                  ? 'bg-brand-soft text-brand-strong'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
              )}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.badge && (
                <span
                  className={cn(
                    'ml-auto rounded-full px-[7px] text-[11px]',
                    item.badge.tone === 'danger' && 'bg-danger-soft text-danger',
                    item.badge.tone === 'new' && 'bg-spark-soft text-spark-ink',
                    item.badge.tone === 'live' && 'bg-ok-soft text-ok',
                  )}
                >
                  {item.badge.text}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
