'use client';

import { useEffect, useState } from 'react';
import { buttonClasses, type ButtonVariant } from './button';
import { Icon } from './icon';

type CopyButtonProps = { text: string; label?: string; variant?: ButtonVariant };

/** Copies text and confirms in place. Falls back to "Select and copy" when the clipboard is blocked. */
export function CopyButton({ text, label = 'Copy', variant = 'ghost' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'blocked'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('blocked');
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClasses(variant, 'sm')}>
      <Icon name={state === 'copied' ? 'check' : 'copy'} size="sm" />
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'blocked' ? 'Select and copy' : label}
      </span>
    </button>
  );
}
