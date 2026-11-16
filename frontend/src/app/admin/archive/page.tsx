'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { toPlatformRole } from '@/lib/dashboard';
import {
  archiveClosedProjects,
  archiveErrorMessage,
  archiveProject,
  fetchArchiveAlerts,
  fetchArchivedProjects,
  type ArchiveAlert,
  type ArchivedProjectPage,
} from '@/lib/archive';

/** RF-020: expedientes archivados, alertas y reintento manual. */
export default function AdminArchivePage() {
  const router = useRouter();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState<ArchivedProjectPage | null>(null);
  const [alerts, setAlerts] = useState<ArchiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data: session }) => {
        if (!active) {
          return;
        }
        if (!session?.user) {
          router.replace('/login');
          return;
        }
        if (
          toPlatformRole((session.user as { role?: unknown }).role) !==
          'ADMINISTRATOR'
        ) {
          router.replace('/access-denied');
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (active) {
          router.replace('/login');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [archived, alertRows] = await Promise.all([
        fetchArchivedProjects(page),
        fetchArchiveAlerts(true),
      ]);
      setData(archived);
      setAlerts(alertRows);
    } catch (loadError: unknown) {
      setError(archiveErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!checking) {
      void load();
    }
  }, [checking, load]);

  async function handleArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(projectId);
    if (!Number.isInteger(id) || id <= 0) {
      toast.error('Indica un ID de proyecto valido.');
      return;
    }
    setBusy(true);
    try {
      const outcome = await archiveProject(id);
      if (outcome.status === 'archived') {
        toast.success(`Proyecto ${id} archivado correctamente.`);
        setProjectId('');
        await load();
      } else {
        toast.error(
          `No se archivo: ${outcome.reason ?? outcome.error ?? outcome.status}.`,
        );
      }
    } catch (archiveError: unknown) {
      toast.error(archiveErrorMessage(archiveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleBatch() {
    setBusy(true);
    try {
      const summary = await archiveClosedProjects();
      toast.success(
        `Barrido completado: ${summary.archived} archivados, ` +
          `${summary.skipped} omitidos, ${summary.failed} fallidos.`,
      );
      await load();
    } catch (batchError: unknown) {
      toast.error(archiveErrorMessage(batchError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/admin/audit"
          className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:underline"
        >
          ← Bitacora de auditoria
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              Expedientes archivados
            </h1>
            <p className="mt-1 text-sm text-muted">
              Proyectos cerrados, congelados en solo lectura con snapshot
              verificable (RF-020).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleBatch()}
            disabled={busy}
            className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-brand-50 disabled:opacity-50"
          >
            {busy ? 'Ejecutando…' : 'Archivar proyectos cerrados'}
          </button>
        </div>

        <form
          onSubmit={handleArchive}
          className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 shadow-sm"
        >
          <label className="block text-xs font-medium text-ink">
            Reintentar archivado por ID de proyecto
            <input
              type="number"
              min={1}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 w-48 rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
              placeholder="123"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !projectId}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Archivar proyecto
          </button>
        </form>

        {alerts.length > 0 && (
          <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Alertas de archivado sin resolver
            </h2>
            <ul className="mt-2 space-y-2">
              {alerts.map((alert) => (
                <li key={alert.alertId} className="text-xs text-amber-900">
                  Proyecto {alert.projectId ?? '(job global)'} ·{' '}
                  {new Date(alert.attemptedAt).toLocaleString('es-MX')} ·{' '}
                  {alert.errorMessage}
                </li>
              ))}
            </ul>
          </section>
        )}

        {loading && (
          <p className="mt-6 text-sm text-muted">Cargando expedientes…</p>
        )}
        {!loading && error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 rounded border border-red-300 px-3 py-1 text-xs font-medium"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <section className="mt-5 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {data.total} expediente(s)
              </h2>
              <span className="text-xs text-muted">
                Pagina {data.page} de {Math.max(1, data.pageInfo.totalPages)}
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5">Proyecto</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Archivado</th>
                    <th className="px-3 py-2.5">Hash del snapshot</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.projectId}
                      className="border-b border-line/70 last:border-0"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/projects/${item.projectId}`}
                          className="font-medium text-ink hover:underline"
                        >
                          #{item.projectId} · {item.title}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {item.status}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {new Date(item.archivedAt).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-muted">
                        {item.snapshotHash.slice(0, 16)}…
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-sm text-muted"
                      >
                        Todavia no hay proyectos archivados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-line px-5 py-3">
              <button
                type="button"
                disabled={!data.pageInfo.hasPreviousPage}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!data.pageInfo.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
              >
                Siguiente
              </button>
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}
