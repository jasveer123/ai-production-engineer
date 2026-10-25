import { ButtonLink } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { SetupStep, SetupStepId } from '../setup-steps';

const ACTION: Record<SetupStepId, { href: string; label: string }> = {
  code: { href: '/integrations/code/', label: 'Connect GitHub' },
  data: { href: '/integrations/', label: 'Send data' },
  services: { href: '/services/', label: 'Set up services' },
  incident: { href: '/integrations/', label: 'Check your data' },
};

/** Onboarding progress: exactly one current step carries the main action. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.state === 'done').length;
  return (
    <section
      aria-labelledby="setup-title"
      className="rounded-lg border border-line bg-surface-raised p-6 shadow-raised max-sm:p-4"
    >
      <CardHeader
        eyebrow="Get started"
        title={
          <span id="setup-title">
            {done} of {steps.length} done
          </span>
        }
      />
      <div
        className="mb-2 mt-4 h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label="Setup progress"
      >
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ol>
        {steps.map((step, i) => (
          <li
            key={step.id}
            className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-3 first:border-t-0 max-sm:grid-cols-[28px_minmax(0,1fr)]"
          >
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full border-2 text-[13px] font-bold',
                step.state === 'done' && 'border-ok bg-ok text-on-brand',
                step.state === 'current' && 'border-brand text-brand',
                step.state === 'todo' && 'border-line-strong text-ink-muted',
              )}
            >
              {step.state === 'done' ? <Icon name="check" size="sm" /> : i + 1}
              <span className="sr-only">
                {step.state === 'done' ? 'Done' : step.state === 'current' ? 'Next' : 'To do'}
              </span>
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  'font-semibold',
                  step.state === 'done' && 'text-ink-muted line-through decoration-1',
                )}
              >
                {step.title}
              </div>
              <div className="text-[13px] leading-5 text-ink-muted">{step.detail}</div>
            </div>
            {step.state === 'current' && (
              <div className="max-sm:col-start-2">
                <ButtonLink href={ACTION[step.id].href} size="sm">
                  {ACTION[step.id].label}
                </ButtonLink>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
