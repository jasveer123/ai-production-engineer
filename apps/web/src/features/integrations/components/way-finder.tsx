'use client';

import { useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Card, Eyebrow } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { DEFAULT_ANSWER, FINDER_OPTIONS, recommend, type FinderAnswer } from '../finder';

/** One question, one recommendation, so nobody has to understand all seven ways first. */
export function WayFinder() {
  const [answer, setAnswer] = useState<FinderAnswer>(DEFAULT_ANSWER);
  const rec = recommend(answer);
  return (
    <Card as="section" className="grid gap-4">
      <div className="grid gap-1">
        <Eyebrow>Which way is right for me?</Eyebrow>
        <h2 className="font-display text-xl font-semibold leading-7">
          Where do your logs live today?
        </h2>
        <p className="m-0 text-ink-muted">
          Pick the closest answer. You can always add more ways later.
        </p>
      </div>
      <div
        role="group"
        aria-label="Where your logs live"
        className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2"
      >
        {FINDER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={answer === option.value}
            onClick={() => setAnswer(option.value)}
            className={cn(
              'grid gap-0.5 rounded-md border px-4 py-3 text-left text-sm font-semibold',
              answer === option.value
                ? 'border-brand bg-brand-soft shadow-[inset_0_0_0_1px_var(--brand)]'
                : 'border-line-strong bg-surface-raised hover:bg-surface-hover',
            )}
          >
            {option.title}
            <span className="text-[13px] font-normal text-ink-muted">{option.hint}</span>
          </button>
        ))}
      </div>
      <div
        aria-live="polite"
        className="flex flex-wrap items-center gap-3 rounded-md bg-ok-soft px-4 py-3"
      >
        <Icon name="check" className="text-ok" />
        <p className="m-0 min-w-0 flex-1">
          <b>{rec.title}</b> {rec.detail}
        </p>
        <ButtonLink href={rec.href} size="sm">
          Show me
        </ButtonLink>
      </div>
    </Card>
  );
}
