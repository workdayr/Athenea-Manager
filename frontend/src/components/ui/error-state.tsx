import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

/**
 * Error recuperable: explica qué pasó y ofrece reintentar. Se usa en lugar de
 * dejar la pantalla en blanco o en un estado de carga eterno.
 */
export function ErrorState({
  title = 'No pudimos cargar esta sección',
  description = 'Revisa tu conexión e inténtalo de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
  action,
  className,
  compact = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-xl border border-danger-line bg-danger-soft text-center',
        compact ? 'gap-2 px-5 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-danger">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 8v5m0 3.2v.1M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {(onRetry || action) && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
