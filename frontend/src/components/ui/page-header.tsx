import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Cabecera de página: título, descripción y acciones.
 *
 * Sin eyebrow: el H1 es el primer nivel de lectura y no compite con una
 * etiqueta en mayúsculas encima.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {breadcrumbs && <div>{breadcrumbs}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
