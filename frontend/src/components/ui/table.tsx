import type {
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Marco de tabla: una sola elevación (borde), scroll horizontal contenido y
 * cabecera fija por color, sin sombras duras.
 */
export function TableShell({
  children,
  className,
  footer,
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-white', className)}>
      {/* `relative` contiene los labels `sr-only` (position: absolute): sin él
          se anclan al viewport y su posición estática ensancha el documento
          cuando la tabla desborda en móvil. */}
      <div className="relative overflow-x-auto">{children}</div>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}

export function Th({
  children,
  className,
  scope = 'col',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-[13px] text-ink', className)} {...props}>
      {children}
    </td>
  );
}

/** Fila vacía dentro de una tabla, con el mismo peso visual que el resto. */
export function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-muted">
        {children}
      </td>
    </tr>
  );
}
