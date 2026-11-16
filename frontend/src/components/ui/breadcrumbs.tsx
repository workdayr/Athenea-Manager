import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Ruta de navegación. El último elemento es la página actual y no es enlace.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Ruta de navegación" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3 shrink-0 text-line-strong"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              )}
              {item.href && !current ? (
                <Link
                  href={item.href as Route}
                  className="rounded text-muted transition-colors duration-150 hover:text-brand-700"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'truncate',
                    current ? 'font-medium text-ink' : 'text-muted',
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Retorno explícito a la pantalla padre. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href as Route}
      className={cn(
        'group -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:text-brand-700',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5m6-7-7 7 7 7" />
      </svg>
      {children}
    </Link>
  );
}
