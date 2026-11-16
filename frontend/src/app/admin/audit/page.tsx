'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { toPlatformRole, type PlatformRole } from '@/lib/dashboard';
import {
  auditErrorMessage,
  fetchAuditLog,
  type AuditFilters,
  type AuditLogPage,
} from '@/lib/audit';

const EMPTY_FILTERS: AuditFilters = {
  actorId: '',
  action: '',
  targetId: '',
  from: '',
  to: '',
};

/** F1-08 / RF-017: consulta filtrada de la bitacora inmutable. */
export default function AdminAuditPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<PlatformRole>('STUDENT');
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        if (!data?.user) {
          router.replace('/login');
          return;
        }
        const role = toPlatformRole((data.user as { role?: unknown }).role);
        if (role !== 'ADMINISTRATOR' && role !== 'COORDINATOR') {
          router.replace('/access-denied');
          return;
        }
        setRole(role);
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
      setResult(await fetchAuditLog(applied, page));
    } catch (loadError: unknown) {
      setError(auditErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    if (!checking) {
      void load();
    }
  }, [checking, load]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied({});
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:underline"
        >
          ← Volver al panel
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              Bitacora de auditoria
            </h1>
            <p className="mt-1 text-sm text-muted">
              Registro inmutable de acciones institucionales (RF-017). Visible
              para {role === 'COORDINATOR' ? 'coordinacion' : 'administracion'}.
            </p>
          </div>
          {role === 'ADMINISTRATOR' && (
            <Link
              href="/admin/archive"
              className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-brand-50"
            >
              Expedientes archivados
            </Link>
          )}
        </div>

        <form
          onSubmit={handleFilter}
          className="mt-5 grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm md:grid-cols-5"
        >
          <Field
            label="ID del actor"
            value={draft.actorId ?? ''}
            onChange={(value) => setDraft({ ...draft, actorId: value })}
          />
          <Field
            label="Accion"
            value={draft.action ?? ''}
            placeholder="milestone_created"
            onChange={(value) => setDraft({ ...draft, action: value })}
          />
          <Field
            label="ID del objetivo"
            value={draft.targetId ?? ''}
            onChange={(value) => setDraft({ ...draft, targetId: value })}
          />
          <Field
            type="date"
            label="Desde"
            value={draft.from ?? ''}
            onChange={(value) => setDraft({ ...draft, from: value })}
          />
          <Field
            type="date"
            label="Hasta"
            value={draft.to ?? ''}
            onChange={(value) => setDraft({ ...draft, to: value })}
          />
          <div className="flex gap-2 md:col-span-5">
            <button
              type="submit"
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
            >
              Limpiar
            </button>
          </div>
        </form>

        {loading && (
          <p className="mt-6 text-sm text-muted">Consultando bitacora…</p>
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

        {!loading && !error && result && (
          <section className="mt-5 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {result.total} registro(s)
              </h2>
              <span className="text-xs text-muted">
                Pagina {result.page} de{' '}
                {Math.max(1, result.pageInfo.totalPages)}
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Actor</th>
                    <th className="px-3 py-2.5">Accion</th>
                    <th className="px-3 py-2.5">Objetivo</th>
                    <th className="px-3 py-2.5">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((entry) => (
                    <tr
                      key={entry.logId}
                      className="border-b border-line/70 last:border-0"
                    >
                      <td className="px-5 py-3 text-xs text-muted">
                        {new Date(entry.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-ink">{entry.actorName}</span>
                        <span className="block text-[11px] text-muted">
                          {entry.actorId}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-ink">
                        {entry.action}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted">
                        {entry.targetId}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {entry.sourceIp}
                      </td>
                    </tr>
                  ))}
                  {result.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-sm text-muted"
                      >
                        No hay registros con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-line px-5 py-3">
              <button
                type="button"
                disabled={!result.pageInfo.hasPreviousPage}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!result.pageInfo.hasNextPage}
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
}) {
  return (
    <label className="block text-xs font-medium text-ink">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
      />
    </label>
  );
}
