'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import integrations from '@/data/integrations.json';
import { guides } from '@/data/guides';
import { IntegrationIcon } from './integration-icon';
export function Catalogue({ docs = false }: { docs?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const matching = integrations.filter(
    (i) =>
      (category === 'all' || i.group === category) &&
      `${i.name} ${i.description} ${i.tagline}`.toLowerCase().includes(query.toLowerCase()),
  );
  const other = docs
    ? guides.filter((g) => `${g.title} ${g.intro}`.toLowerCase().includes(query.toLowerCase()))
    : [];
  return (
    <>
      <div className="catalogue-controls">
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={docs ? 'Search documentation…' : 'Find an integration…'}
            aria-label={docs ? 'Search documentation' : 'Search integrations'}
          />
          <kbd>/</kbd>
        </label>
        {!docs && (
          <div className="category-buttons" aria-label="Integration categories">
            {[
              ['all', 'All integrations'],
              ['collect', 'Collect it for me'],
              ['code', 'Send from my code'],
            ].map(([id, label]) => (
              <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {docs && other.length > 0 && (
        <div className="guide-grid">
          {other.map((g) => (
            <Link href={`/docs/${g.slug}/`} key={g.slug}>
              <span>{g.category}</span>
              <h3>
                {g.title}
                <ArrowUpRight size={14} />
              </h3>
              <p>{g.intro}</p>
            </Link>
          ))}
        </div>
      )}
      <div className="catalogue-heading">
        <h2>Integration guides</h2>
        <span>
          {matching.length} {matching.length === 1 ? 'guide' : 'guides'}
        </span>
      </div>
      <div className="catalogue-grid">
        {matching.map((i) => (
          <Link className="catalogue-card" href={`/docs/${i.id}/`} key={i.id}>
            <div>
              <IntegrationIcon id={i.id} />
              <ArrowUpRight size={16} />
            </div>
            <span className="catalogue-category">
              {i.group === 'collect' ? 'Collect it for me' : 'Send from my code'}
            </span>
            <h3>{i.name}</h3>
            <p>{i.description}</p>
            <div className="catalogue-meta">
              <span>
                {i.methods.length} setup {i.methods.length === 1 ? 'method' : 'methods'}
              </span>
              <span>{i.codeChange ? 'App integration' : 'Infrastructure integration'}</span>
            </div>
          </Link>
        ))}
      </div>
      {!matching.length && !other.length && (
        <div className="empty-state">
          <SlidersHorizontal size={24} />
          <h3>No matching guides</h3>
          <p>Try a different term or clear your search.</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
