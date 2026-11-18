import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-surface-2 text-muted',
  info: 'border-info-line bg-info-soft text-info',
  success: 'border-success-line bg-success-soft text-success',
  warning: 'border-warning-line bg-warning-soft text-warning',
  danger: 'border-danger-line bg-danger-soft text-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Punto de estado compacto para tablas y listas. */
export function StatusDot({ tone }: { tone: BadgeTone }) {
  const colors: Record<BadgeTone, string> = {
    neutral: 'bg-muted',
    info: 'bg-brand-500',
    success: 'bg-success',
    warning: 'bg-amber-500',
    danger: 'bg-danger',
  };
  return (
    <span
      aria-hidden="true"
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', colors[tone])}
    />
  );
}
