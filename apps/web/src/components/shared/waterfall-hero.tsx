import type { ReactNode } from 'react';

/** Staggered bars like spans in a request waterfall: one failing (danger), one fixed (ok). */
const BARS = [
  'w-[62%] ml-[4%] bg-brand-soft',
  'w-[70%] ml-[16%] bg-brand-soft',
  'w-[38%] ml-[30%] bg-danger-soft',
  'w-[56%] ml-[40%] bg-brand-soft',
  'w-[30%] ml-[52%] bg-ok-soft',
];

/** A raised hero band with the brand's request-waterfall motif in the corner. */
export function WaterfallHero({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-line bg-surface-raised p-8 shadow-raised max-sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 top-5 grid w-[300px] gap-2 max-md:hidden"
      >
        {BARS.map((bar) => (
          <span key={bar} className={`h-2 rounded-full ${bar}`} />
        ))}
      </div>
      <div className="relative grid gap-5">{children}</div>
    </section>
  );
}
