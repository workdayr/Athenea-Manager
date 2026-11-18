import { cn } from '@/lib/cn';

/** Bloque de carga con shimmer. Decorativo: los lectores de pantalla reciben
 * el estado desde el contenedor que lo usa (`aria-busy` + texto `sr-only`). */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block', className)} />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn('block space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <span
          key={index}
          className="skeleton block h-3"
          style={{ width: index === lines - 1 ? '62%' : '100%' }}
        />
      ))}
    </span>
  );
}

/** Filas de tabla en carga. Se usa dentro de `<tbody>`. */
export function SkeletonRows({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} aria-hidden="true" className="border-t border-line">
          {Array.from({ length: columns }).map((__, column) => (
            <td key={column} className="px-4 py-3">
              <span
                className="skeleton block h-3"
                style={{ width: `${[80, 55, 65, 45, 70, 60][column % 6]}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-xl border border-line bg-white p-5', className)}
    >
      <span className="skeleton block h-3 w-24" />
      <span className="skeleton mt-4 block h-7 w-20" />
      <span className="skeleton mt-4 block h-3 w-full" />
    </div>
  );
}
