import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

const STEPS: Array<{ icon: IconName; title: string; text: string; ai?: boolean }> = [
  {
    icon: 'plug',
    title: 'Pick one way',
    text: 'Not sure? Answer one question below and we suggest it.',
  },
  {
    icon: 'shield',
    title: 'Paste your token',
    text: 'Every snippet already has your workspace token in it.',
  },
  {
    icon: 'radio',
    title: 'Data arrives',
    text: 'The tile turns green within a minute. Secrets are hidden first.',
  },
  {
    icon: 'spark',
    title: 'The AI investigates',
    text: 'When errors start, it finds the cause and proposes a tested fix.',
    ai: true,
  },
];

/** Four numbered steps that explain integrations before anyone has to choose. */
export function HowItWorks() {
  return (
    <ol className="grid grid-cols-4 max-md:grid-cols-1">
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="grid content-start gap-1.5 p-4 [&+&]:border-l [&+&]:border-dashed [&+&]:border-line-strong max-md:[&+&]:border-l-0 max-md:[&+&]:border-t"
        >
          <span
            className={cn(
              'grid size-9 place-items-center rounded-md',
              step.ai ? 'bg-spark-soft text-spark-ink' : 'bg-brand-soft text-brand-strong',
            )}
          >
            <Icon name={step.icon} />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
            Step {i + 1}
          </span>
          <span className="font-display text-[15px] font-semibold leading-[22px]">
            {step.title}
          </span>
          <p className="m-0 text-[13px] leading-5 text-ink-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
