'use client';

import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/lib/use-is-client';
import { usePresence } from '@/lib/use-presence';
import { Button } from './button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bloquea el scroll del documento mientras haya un overlay abierto.
 * Usa un contador para que dos overlays apilados no se desbloqueen entre sí.
 */
let scrollLocks = 0;
let previousOverflow = '';

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    if (scrollLocks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [active]);
}

/**
 * Comportamiento común de overlays: foco inicial dentro del panel, ciclo de
 * Tab contenido, cierre con Escape y devolución del foco al disparador.
 */
export function useOverlayBehavior(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const initial =
      container?.querySelector<HTMLElement>('[data-autofocus]') ??
      container?.querySelector<HTMLElement>(FOCUSABLE) ??
      container;
    initial?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) {
        return;
      }
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus?.();
    };
  }, [active, containerRef]);
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

/**
 * Diálogo modal. Escape cierra, Tab queda contenido dentro del panel y el
 * foco vuelve al elemento que lo abrió.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const mounted = usePresence(open, 200);
  const panelRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  useBodyScrollLock(open);
  useOverlayBehavior(open, panelRef, onClose);

  if (!isClient || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        data-state={open ? 'open' : 'closed'}
        className="absolute inset-0 cursor-default bg-ink/40 transition-opacity duration-200 ease-snappy starting:opacity-0 data-[state=closed]:opacity-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-state={open ? 'open' : 'closed'}
        className={`relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl bg-white shadow-overlay outline-none transition-[opacity,transform] duration-200 ease-snappy starting:scale-[0.97] starting:opacity-0 data-[state=closed]:scale-[0.97] data-[state=closed]:opacity-0 ${MODAL_SIZES[size]}`}
      >
        <div className="px-6 pt-6">
          <h2 id="modal-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
        {children && <div className="px-6 pt-4">{children}</div>}
        {footer && (
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
}

/**
 * Confirmación explícita para acciones destructivas o irreversibles.
 * Sustituye a `window.confirm` con la misma semántica y el sistema visual.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
