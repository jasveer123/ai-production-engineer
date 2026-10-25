import Link from 'next/link';
import { cn } from '@/lib/cn';

export type TabNavItem = { href: string; label: string; count?: string | number };

type TabNavProps = { label: string; items: TabNavItem[]; current: string };

/** Tabs that are real links, so every tab has its own URL and works without JavaScript. */
export function TabNav({ label, items, current }: TabNavProps) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <ul className="inline-flex gap-0.5 rounded-md bg-surface-sunken p-[3px]">
        {items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-[34px] items-center gap-2 whitespace-nowrap rounded-[8px] px-3 text-sm font-semibold',
                  active
                    ? 'bg-surface-raised text-ink shadow-raised'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] leading-4',
                      active
                        ? 'bg-brand-soft text-brand-strong'
                        : 'bg-surface-hover text-ink-muted',
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
