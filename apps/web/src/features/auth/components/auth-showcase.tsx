import IncidentChart from "@/assets/svg/incident-chart.svg"
import { Logo } from "@/components/shared"
import { Card, Eyebrow } from "@/components/ui"

interface IncidentStep {
  className: string
  time: string
  message: string
}

const STEPS: IncidentStep[] = [
  { className: "incident-p1", time: "1 · 12:04", message: "Error spike detected" },
  { className: "incident-p2", time: "2 · 12:07", message: "Cause found in payments.charge" },
  { className: "incident-p3", time: "3 · 12:19", message: "You approved the fix" },
  { className: "incident-p4", time: "4 · 12:51", message: "Recovery verified" },
]

export function AuthShowcase() {
  return (
    <Card
      ticked
      className="hidden min-h-0 justify-between gap-0 border-line-strong p-12 shadow-[0_0_3.75rem_-1.5rem_var(--glow-strong)] [--tick:var(--brand)] lg:sticky lg:top-3 lg:flex lg:h-[calc(100svh-1.5rem)] lg:self-start"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(35rem_18.75rem_at_18%_0%,var(--glow-strong),transparent_70%)]"
      />
      <Logo className="relative z-10 self-start" />
      <div aria-hidden className="relative z-10 mx-auto grid w-full max-w-[35rem] gap-12 py-10">
        <div className="grid max-w-[30rem] gap-4">
          <Eyebrow>Incident to proof</Eyebrow>
          <h2 className="font-heading text-[2.75rem] leading-[3rem] font-bold tracking-[-0.03em] text-balance">
            Every incident ends with proof it is fixed.
          </h2>
          <p className="text-base leading-[1.625rem] text-muted-foreground">
            It traces the error, finds the cause, opens a tested fix and watches production until
            the error rate is back to zero. You approve every change.
          </p>
        </div>
        <figure className="m-0 w-full">
          <IncidentChart />
          <ol className="mt-8 grid list-none grid-cols-4 gap-5 p-0">
            {STEPS.map((step) => (
              <li
                key={step.className}
                className={`${step.className} grid content-start gap-1 border-t border-line-strong pt-3`}
              >
                <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-muted-foreground">
                  {step.time}
                </span>
                <span className="text-[0.8125rem] leading-5 font-medium">{step.message}</span>
              </li>
            ))}
          </ol>
        </figure>
      </div>
      <p className="relative z-10 text-[0.8125rem] text-muted-foreground">
        Nothing merges or rolls back without a person approving it.
      </p>
    </Card>
  )
}
