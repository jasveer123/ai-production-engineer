'use client';

import { PASSWORD_MIN } from '@ape/api-contracts';
import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field, Input } from '@/components/ui/form';

type Props = {
  id: string;
  label?: string;
  autoComplete: 'current-password' | 'new-password';
  error?: string | null;
  showRules?: boolean;
  registration: UseFormRegisterReturn;
};

/** Password with a show/hide toggle. New passwords show the length rule. */
export function PasswordField({
  id,
  label = 'Password',
  autoComplete,
  error,
  showRules,
  registration,
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={
        showRules
          ? `At least ${PASSWORD_MIN} characters. A few unrelated words work well.`
          : undefined
      }
    >
      <div className="relative">
        <Input
          id={id}
          {...registration}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={128}
          invalid={Boolean(error)}
          className="pr-16"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-sm px-2 text-xs font-semibold text-ink-muted hover:bg-surface-hover"
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  );
}
