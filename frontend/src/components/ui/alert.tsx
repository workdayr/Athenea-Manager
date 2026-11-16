import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<AlertTone, { shell: string; icon: string; title: string }> = {
  info: {
    shell: 'border-info-line bg-info-soft text-info',
    icon: 'text-brand-600',
    title: 'text-brand-800',
  },
  success: {
    shell: 'border-success-line bg-success-soft text-success',
    icon: 'text-success',
    title: 'text-success',
  },
  warning: {
    shell: 'border-warning-line bg-warning-soft text-warning',
    icon: 'text-warning',
    title: 'text-warning',
  },
  danger: {
    shell: 'border-danger-line bg-danger-soft text-danger',
    icon: 'text-danger',
    title: 'text-danger',
  },
};

const ICONS: Record<AlertTone, ReactNode> = {
  info: <path d="M12 11v5m0-8.2v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  success: <path d="m5 12.5 4.5 4.5L19 7" />,
  warning: (
    <path d="M12 8v5m0 3.2v.1M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  ),
  danger: <path d="M12 8v5m0 3.2v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
};

/**
 * Aviso en línea. `danger` se anuncia de inmediato (`role="alert"`); el resto
 * espera al lector (`role="status"`).
 */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed',
        styles.shell,
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[tone]}
      </svg>
      <div className="min-w-0 flex-1">
        {title && <p className={cn('font-semibold', styles.title)}>{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
