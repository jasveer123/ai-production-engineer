import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-brand text-on-brand hover:bg-brand-strong',
  secondary: 'border-line-strong bg-surface-raised text-ink hover:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-surface-hover',
  danger: 'border-line-strong bg-surface-raised text-danger hover:bg-danger-soft',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 rounded-md px-4 text-sm',
  sm: 'h-8 rounded-sm px-3 text-[13px]',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={cn(buttonClasses(variant, size), className)} {...rest} />;
}

type ButtonLinkProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonClasses(variant, size), className)}>
      {children}
    </Link>
  );
}
