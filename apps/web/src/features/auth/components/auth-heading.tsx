import type { ReactNode } from 'react';

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 grid gap-2">
      <h1 className="m-0 font-display text-[32px] font-[680] leading-10 tracking-[-0.02em]">
        {title}
      </h1>
      {children && <p className="m-0 text-[15px] leading-6 text-ink-muted">{children}</p>}
    </div>
  );
}
