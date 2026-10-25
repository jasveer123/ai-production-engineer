import Link from 'next/link';
import { Logo } from '@/components/shell/logo';

/**
 * Product story beside the sign-in forms: one incident's error rate, from spike to verified recovery.
 * The line draws once on load; with reduced motion it is shown complete.
 */
const BEFORE =
  'M0 192 L60 190 L100 192 L118 186 L130 70 L150 84 L170 62 L195 78 L220 58 L250 74 L260 68 L275 60 L300 80 L325 64 L350 76 L380 66 L400 72';
const AFTER = 'M400 72 L415 120 L430 170 L445 192 L480 194 L540 193 L600 194';

const PINS = [
  { x: 130, y: 70, title: 'Error spike detected', time: '12:04', delay: '0.35s' },
  { x: 260, y: 68, title: 'Cause found in payments.charge', time: '12:07', delay: '0.8s' },
  { x: 400, y: 72, title: 'You approved the fix', time: '12:19', delay: '1.4s' },
  { x: 540, y: 193, title: 'Recovery verified', time: '12:51', delay: '2.2s' },
];

export function AuthShowcase() {
  return (
    <aside className="sticky top-3 hidden h-[calc(100dvh-24px)] min-h-[640px] flex-col overflow-hidden rounded-[20px] bg-brand-soft p-10 lg:flex xl:p-14">
      <Link href="/" aria-label="Home" className="self-start rounded-md">
        <Logo />
      </Link>

      <div aria-hidden="true" className="mx-auto my-auto grid w-full max-w-[560px] gap-12 py-10">
        <div className="grid max-w-[30rem] gap-4">
          <h2 className="m-0 font-display text-[44px] font-[680] leading-[48px] tracking-[-0.025em]">
            Every incident ends with proof it’s fixed.
          </h2>
          <p className="m-0 text-[17px] leading-7 text-ink-muted">
            It traces the error, finds the cause, opens a tested fix and watches production until
            the error rate is back to zero. You approve every change.
          </p>
        </div>

        <figure className="m-0 w-full">
          <svg viewBox="0 0 600 240" className="block w-full overflow-visible">
            {[50, 100, 150].map((y) => (
              <line key={y} x1="0" x2="600" y1={y} y2={y} className="stroke-brand opacity-15" />
            ))}
            <line x1="0" x2="600" y1="200" y2="200" className="stroke-brand opacity-40" />

            <path
              d={`${BEFORE} L400 200 L0 200 Z`}
              className="fill-danger-soft animate-[ape-fade-in_0.8s_ease-out_0.6s_both]"
            />
            <line
              x1="400"
              x2="400"
              y1="10"
              y2="200"
              strokeDasharray="4 5"
              className="stroke-brand animate-[ape-fade-in_0.4s_ease-out_1.3s_both]"
              strokeWidth="1.5"
            />
            <text
              x="408"
              y="22"
              className="fill-brand font-sans text-[13px] font-semibold animate-[ape-fade-in_0.4s_ease-out_1.3s_both]"
            >
              Fix deployed
            </text>

            <path
              d={BEFORE}
              pathLength={1}
              fill="none"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-danger [stroke-dasharray:1] animate-[ape-draw_1.4s_ease-in-out_both]"
            />
            <path
              d={AFTER}
              pathLength={1}
              fill="none"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-brand [stroke-dasharray:1] animate-[ape-draw_0.8s_ease-out_1.4s_both]"
            />

            {PINS.map((pin, i) => (
              <g
                key={pin.title}
                className="animate-[ape-fade-in_0.4s_ease-out_both]"
                style={{ animationDelay: pin.delay }}
              >
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r="11"
                  className="fill-ink stroke-brand-soft"
                  strokeWidth="3"
                />
                <text
                  x={pin.x}
                  y={pin.y + 4}
                  textAnchor="middle"
                  className="fill-surface-raised font-sans text-[12px] font-bold"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>

          <ol className="m-0 mt-8 grid list-none grid-cols-4 gap-5 p-0">
            {PINS.map((pin, i) => (
              <li
                key={pin.title}
                className="grid content-start gap-1 border-t-2 border-ink pt-3 animate-[ape-fade-in_0.4s_ease-out_both]"
                style={{ animationDelay: pin.delay }}
              >
                <span className="text-xs font-semibold tabular-nums text-ink-muted">
                  {i + 1}. {pin.time}
                </span>
                <span className="text-sm font-semibold leading-5">{pin.title}</span>
              </li>
            ))}
          </ol>
        </figure>
      </div>

      <p className="m-0 text-[13px] text-ink-muted">
        Nothing merges or rolls back without a person approving it.
      </p>
    </aside>
  );
}
