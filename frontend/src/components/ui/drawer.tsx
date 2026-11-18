'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useIsClient } from '@/lib/use-is-client';
import { usePresence } from '@/lib/use-presence';
import { useOverlayBehavior } from './modal';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  side?: 'left' | 'right';
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Panel lateral para navegación móvil y listas contextuales.
 *
 * Se desliza con `--ease-drawer` (300 ms), cierra con Escape, contiene el Tab
 * dentro del panel y devuelve el foco al disparador al cerrarse.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  side = 'left',
  children,
  footer,
  className,
}: DrawerProps) {
  const mounted = usePresence(open, 280);
  const panelRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  useOverlayBehavior(open, panelRef, onClose);

  if (!isClient || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        data-state={open ? 'open' : 'closed'}
        className="absolute inset-0 cursor-default bg-ink/40 transition-opacity duration-300 ease-drawer starting:opacity-0 data-[state=closed]:opacity-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'absolute inset-y-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-white shadow-overlay outline-none transition-transform duration-300 ease-drawer',
          side === 'left' ? 'left-0' : 'right-0',
          side === 'left'
            ? 'starting:-translate-x-full data-[state=closed]:-translate-x-full'
            : 'starting:translate-x-full data-[state=closed]:translate-x-full',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-line p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
