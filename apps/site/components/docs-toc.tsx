'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, List } from 'lucide-react';
import { appUrl } from '@/data/products';
export function DocsToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const update = () => {
      let current = items[0]?.id;
      for (const item of items) {
        if ((document.getElementById(item.id)?.getBoundingClientRect().top ?? Infinity) <= 170)
          current = item.id;
      }
      setActive(current);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, [items]);
  return (
    <aside className="doc-toc">
      <span>
        <List size={13} /> On this page
      </span>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={active === item.id ? 'location' : undefined}
        >
          {item.label}
        </a>
      ))}
      <div>
        Ready to connect?
        <a href={`${appUrl}/integrations`}>
          Open Integrations <ArrowUpRight size={12} />
        </a>
      </div>
    </aside>
  );
}
