'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/dashboard/icons';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notifications';

const POLL_INTERVAL_MS = 30_000;
const PANEL_PAGE_SIZE = 8;

const TYPE_LABELS: Record<string, string> = {
  Decision: 'Decisión',
  Milestone: 'Hito',
  Evidence: 'Evidencia',
  Archive: 'Archivado',
  Role: 'Rol',
  Invitation: 'Invitación',
  Deadline: 'Plazo',
  Retention: 'Retención',
  Sla: 'SLA de revisión',
  System: 'Sistema',
};

function relativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * RF-014: campana de notificaciones in-app.
 *
 * Sigue el patron actual del frontend (`getApolloClient()` por operacion,
 * sin ApolloProvider) y refresca el contador cada 30 s. El panel lista las
 * recientes y permite marcar una o todas como leidas.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const page = await fetchNotifications({ pageSize: PANEL_PAGE_SIZE });
      setItems(page.items);
      setUnreadCount(page.unreadCount);
      setError(null);
    } catch {
      setError('No fue posible cargar las notificaciones.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const refreshCount = async () => {
      try {
        const count = await fetchUnreadNotificationCount();
        if (active) {
          setUnreadCount(count);
        }
      } catch {
        // Silencioso: el polling no debe interrumpir la navegacion.
      }
    };
    void refreshCount();
    const timer = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  async function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next) {
      await load(true);
    }
  }

  async function handleMarkRead(notification: AppNotification) {
    if (notification.readAt) {
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.notificationId === notification.notificationId
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await markNotificationRead(notification.notificationId);
    } catch {
      void load();
    }
  }

  async function handleMarkAll() {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => void togglePanel()}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
        aria-label={
          unreadCount > 0
            ? `Notificaciones (${unreadCount} sin leer)`
            : 'Notificaciones'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="bell" className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-4 text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Notificaciones</p>
              <p className="text-[11px] text-muted">
                {unreadCount > 0
                  ? `${unreadCount} sin leer`
                  : 'Todo al día'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              disabled={unreadCount === 0}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
            >
              Marcar todas
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-xs text-muted">
                Cargando notificaciones…
              </p>
            )}
            {!loading && error && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => void load(true)}
                  className="mt-2 text-xs font-medium text-brand-700 hover:underline"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted">
                No tienes notificaciones todavía.
              </p>
            )}
            {!loading && !error && items.length > 0 && (
              <ul className="divide-y divide-line">
                {items.map((notification) => {
                  const content = (
                    <span className="block">
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700">
                          {TYPE_LABELS[notification.type] ?? notification.type}
                        </span>
                        <span className="text-[10px] text-muted">
                          {relativeDate(notification.createdAt)}
                        </span>
                        {!notification.readAt && (
                          <span
                            aria-label="Sin leer"
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500"
                          />
                        )}
                      </span>
                      <span
                        className={`mt-1 block text-[12.5px] ${
                          notification.readAt
                            ? 'font-medium text-ink/80'
                            : 'font-semibold text-ink'
                        }`}
                      >
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
                        {notification.message}
                      </span>
                    </span>
                  );

                  return (
                    <li key={notification.notificationId}>
                      {notification.link ? (
                        <Link
                          href={notification.link}
                          onClick={() => {
                            void handleMarkRead(notification);
                            setOpen(false);
                          }}
                          className={`block px-4 py-3 transition hover:bg-brand-50/60 ${
                            notification.readAt ? 'opacity-80' : ''
                          }`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(notification)}
                          className={`block w-full px-4 py-3 text-left transition hover:bg-brand-50/60 ${
                            notification.readAt ? 'opacity-80' : ''
                          }`}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
