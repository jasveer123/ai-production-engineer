'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronDown, Search, X } from 'lucide-react';
import integrations from '@/data/integrations.json';
import { guides } from '@/data/guides';
const categories = ['Start here', 'Product guides', 'Connections', 'Integrations'];
const entries = [
  ...guides.map((g) => ({
    title: g.title,
    slug: g.slug,
    category: g.category,
  })),
  ...integrations.map((i) => ({
    title: i.name,
    slug: i.id,
    category: 'Integrations',
  })),
];
export function DocsNav() {
  const path = usePathname().replace(/\/$/, '');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const filtered = entries.filter((item) =>
    `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <aside className="docs-nav docs-nav-v2">
      <button
        className="mobile-docs-toggle"
        aria-expanded={expanded}
        aria-controls="documentation-navigation"
        onClick={() => setExpanded(!expanded)}
      >
        <BookOpen size={16} /> Browse documentation <ChevronDown size={15} />
      </button>
      <div
        className={`docs-navigation ${expanded ? 'is-expanded' : ''}`}
        id="documentation-navigation"
      >
        <Link className="docs-home" href="/docs/">
          <BookOpen size={17} /> Developer docs <span>GUIDES</span>
        </Link>
        <label className="docs-search">
          <Search size={14} />
          <input
            aria-label="Find a guide"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a guide…"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear guide search">
              <X size={13} />
            </button>
          )}
        </label>
        <nav aria-label="Documentation guides" className="docs-groups">
          {categories.map((category) => {
            const items = filtered.filter((item) => item.category === category);
            return (
              items.length > 0 && (
                <details
                  className="docs-group"
                  key={`${category}:${query ? 'search' : 'browse'}`}
                  open
                >
                  <summary>
                    {category}
                    <ChevronDown size={12} />
                  </summary>
                  <div>
                    {items.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/docs/${item.slug}/`}
                        aria-current={path === `/docs/${item.slug}` ? 'page' : undefined}
                        onClick={() => setExpanded(false)}
                      >
                        <span />
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </details>
              )
            );
          })}
          {filtered.length === 0 && (
            <p className="docs-empty" role="status">
              No guides found. Try “logs” or “Docker”.
            </p>
          )}
        </nav>
        <Link className="docs-sidebar-help" href="/docs/getting-started/">
          New to Pramaan?<strong>Start with the essentials →</strong>
        </Link>
      </div>
    </aside>
  );
}
