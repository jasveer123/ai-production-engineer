import type { ReactNode } from 'react';

type ToggleProps = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
};

export function Toggle({ id, label, description, defaultChecked, disabled }: ToggleProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-5">
      <input
        id={id}
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-10 flex-none rounded-full border border-line-strong bg-surface-sunken transition-colors after:absolute after:left-[3px] after:top-[3px] after:size-4 after:rounded-full after:bg-ink-muted after:transition-transform peer-checked:border-brand peer-checked:bg-brand peer-checked:after:translate-x-4 peer-checked:after:bg-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-50"
      />
      <span className="min-w-0">
        <span className="font-semibold">{label}</span>
        {description && <span className="block text-[13px] text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}
