import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Contenedor de sección: la elevación se declara una sola vez (borde),
 * nunca borde + sombra ancha a la vez.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const hasHeader = title || description || actions;
  return (
    <section
      id={id}
      className={cn('overflow-hidden rounded-xl border border-line bg-white', className)}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-ink">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Tarjeta enlazada: única elevación al pasar el cursor, con desplazamiento sutil. */
export function CardLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'group block rounded-xl border border-line bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 ease-snappy hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-raised',
        className,
      )}
    >
      {children}
    </a>
  );
}
