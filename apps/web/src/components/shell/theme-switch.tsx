'use client';

import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import {
  parseThemeChoice,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  themeAttribute,
  type ThemeChoice,
} from '@/features/theme/theme';

const OPTIONS: Record<ThemeChoice, { label: string; icon: IconName }> = {
  light: { label: 'Light', icon: 'sun' },
  dark: { label: 'Dark', icon: 'moon' },
  system: { label: 'System', icon: 'monitor' },
};

function readStored(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    setChoice(readStored());
  }, []);

  function select(next: ThemeChoice) {
    setChoice(next);
    const attr = themeAttribute(next);
    if (attr) document.documentElement.setAttribute('data-theme', attr);
    else document.documentElement.removeAttribute('data-theme');
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex gap-0.5 rounded-full border border-line bg-surface-sunken p-[3px]"
    >
      {THEME_CHOICES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          onClick={() => select(value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold',
            choice === value
              ? 'bg-surface-raised text-ink shadow-raised'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          <Icon name={OPTIONS[value].icon} size="sm" />
          <span className="max-sm:sr-only">{OPTIONS[value].label}</span>
        </button>
      ))}
    </div>
  );
}
