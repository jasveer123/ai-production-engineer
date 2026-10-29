export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="12" className="fill-brand" />
      <rect x="10" y="12" width="20" height="5" rx="2.5" className="fill-on-brand" />
      <rect x="16" y="21" width="22" height="5" rx="2.5" className="fill-on-brand" opacity=".72" />
      <rect x="10" y="30" width="11" height="5" rx="2.5" className="fill-on-brand" />
      <path
        d="M25 33.5l3.5 3.5L38 27.5"
        fill="none"
        className="stroke-spark"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ workspace }: { workspace?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[15px] font-bold leading-[18px] tracking-[-0.01em]">
        AI Production Engineer
        {workspace && (
          <small className="block font-sans text-[11px] font-normal leading-[14px] tracking-[0.02em] text-ink-muted">
            {workspace}
          </small>
        )}
      </span>
    </span>
  );
}
