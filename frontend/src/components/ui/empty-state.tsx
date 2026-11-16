import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Estado vacío con una acción clara. El icono es opcional: cuando la pantalla
 * no tiene una ilustración propia, el título y la CTA sostienen el mensaje.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface-2 text-center',
        compact ? 'gap-2 px-5 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      {icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-brand-600">
          {icon}
        </span>
      )}
      <div className="max-w-md">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
