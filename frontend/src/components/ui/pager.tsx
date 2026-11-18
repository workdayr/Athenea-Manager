'use client';

import { Button } from './button';

/**
 * Paginación previa/siguiente. Los extremos se deshabilitan en lugar de
 * desaparecer para que el control no cambie de forma entre páginas.
 */
export function Pager({
  page,
  pageCount,
  onPrev,
  onNext,
  busy = false,
  className,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  busy?: boolean;
  className?: string;
}) {
  const total = Math.max(1, pageCount);
  return (
    <nav
      aria-label="Paginación"
      className={`flex flex-wrap items-center justify-between gap-2 ${className ?? ''}`}
    >
      <p className="text-xs text-muted" aria-live="polite">
        Página {page} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={busy || page <= 1}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={busy || page >= total}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
