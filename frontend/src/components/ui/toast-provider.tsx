'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  title?: string;
  variant?: ToastVariant;
  /** 0 = permanece hasta que el usuario lo cierre. */
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
  durationMs: number;
}

export interface ToastApi {
  show(options: ToastOptions): string;
  success(message: string, title?: string): string;
  error(message: string, title?: string): string;
  warning(message: string, title?: string): string;
  info(message: string, title?: string): string;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_SUCCESS_MS = 5_000;
const MAX_VISIBLE = 5;

/**
 * RF-014: notificaciones efimeras no bloqueantes.
 * - Exito/info se cierran solos a los 5 s.
 * - Error/advertencia permanecen hasta que el usuario los cierre.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions): string => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    const variant = options.variant ?? 'info';
    const durationMs =
      options.durationMs ??
      (variant === 'error' || variant === 'warning'
        ? 0
        : DEFAULT_SUCCESS_MS);
    setToasts((current) => [
      ...current.slice(-(MAX_VISIBLE - 1)),
      { ...options, id, variant, durationMs },
    ]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, title) =>
        show({ message, title, variant: 'success' }),
      error: (message, title) => show({ message, title, variant: 'error' }),
      warning: (message, title) =>
        show({ message, title, variant: 'warning' }),
      info: (message, title) => show({ message, title, variant: 'info' }),
      dismiss,
    }),
    [dismiss, show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider.');
  }
  return context;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; title: string; icon: string }
> = {
  success: {
    container: 'border-green-200 bg-green-50 text-green-900',
    title: 'text-green-900',
    icon: 'bg-green-600',
  },
  error: {
    container: 'border-red-200 bg-red-50 text-red-900',
    title: 'text-red-900',
    icon: 'bg-red-600',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'text-amber-900',
    icon: 'bg-amber-500',
  },
  info: {
    container: 'border-blue-200 bg-blue-50 text-blue-900',
    title: 'text-blue-900',
    icon: 'bg-blue-600',
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.durationMs <= 0) {
      return;
    }
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toast.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const styles = VARIANT_STYLES[toast.variant];
  const role = toast.variant === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${styles.container}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.icon}`}
      />
      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className={`text-[13px] font-semibold ${styles.title}`}>
            {toast.title}
          </p>
        )}
        <p className="text-[13px] leading-snug">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
