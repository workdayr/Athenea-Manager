'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/field';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';
import { SkeletonRows } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
import type { DashboardUser } from '@/lib/dashboard';
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

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * F1-08 / RF-017: consulta filtrada de la bitácora inmutable.
 * Solo lectura: la pantalla no ofrece acciones sobre los registros.
 */
export default function AdminAuditPage() {
  return (
    <AuthedShell
      activeId="configuracion"
      searchPlaceholder="Buscar en la bitácora por actor, acción o proyecto…"
    >
      {(user) => <AdminAuditContent user={user} />}
    </AuthedShell>
  );
}

function AdminAuditContent({ user }: { user: DashboardUser }) {
  const canRead =
    user.role === 'ADMINISTRATOR' || user.role === 'COORDINATOR';

  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditLogPage | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const requestKey = `${page}|${JSON.stringify(applied)}|${reloadKey}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!canRead) {
      return;
    }
    const key = `${page}|${JSON.stringify(applied)}|${reloadKey}`;
    let active = true;
    fetchAuditLog(applied, page)
      .then((rows) => {
        if (active) {
          setResult(rows);
          setError(null);
          setLoadedKey(key);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setResult(null);
          setError(auditErrorMessage(loadError));
          setLoadedKey(key);
        }
      });
    return () => {
      active = false;
    };
  }, [applied, canRead, page, reloadKey]);

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

  if (!canRead) {
    return (
      <NoAccess
        title="Bitácora reservada a la administración"
        description="Solo la administración y la coordinación pueden consultar el registro de auditoría del sistema."
      />
    );
  }

  const hasFilters = Object.values(applied).some(
    (value) => typeof value === 'string' && value.length > 0,
  );
  const pageCount = result ? Math.max(1, result.pageInfo.totalPages) : 1;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Configuración y auditoría' },
        ]}
      />

      <PageHeader
        title="Bitácora de auditoría"
        description="Registro inmutable de las acciones institucionales. Visible para administración y coordinación; no admite edición ni borrado."
        actions={
          user.role === 'ADMINISTRATOR' ? (
            <ButtonLink href="/admin/archive" variant="secondary" size="sm">
              Expedientes archivados
            </ButtonLink>
          ) : undefined
        }
      />

      <form onSubmit={handleFilter} noValidate>
        <SectionCard
          title="Filtros"
          description="Combina criterios para acotar el periodo o una acción concreta."
        >
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Input
                id="audit-actor"
                label="ID del actor"
                value={draft.actorId ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, actorId: event.target.value })
                }
                placeholder="usr_…"
              />
              <Input
                id="audit-action"
                label="Acción"
                value={draft.action ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, action: event.target.value })
                }
                placeholder="milestone_created"
              />
              <Input
                id="audit-target"
                label="ID del objetivo"
                value={draft.targetId ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, targetId: event.target.value })
                }
                placeholder="123"
              />
              <Input
                id="audit-from"
                label="Desde"
                type="date"
                value={draft.from ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, from: event.target.value })
                }
              />
              <Input
                id="audit-to"
                label="Hasta"
                type="date"
                value={draft.to ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, to: event.target.value })
                }
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Limpiar
              </Button>
              <Button
                type="submit"
                size="sm"
                leadingIcon={<Icon name="filter" className="h-3.5 w-3.5" />}
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        </SectionCard>
      </form>

      {error && (
        <ErrorState
          className="min-h-[260px] justify-center bg-white"
          title="No pudimos consultar la bitácora"
          description={error}
          onRetry={() => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!error && (
        <section
          aria-labelledby="audit-heading"
          className="overflow-hidden rounded-xl border border-line bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="audit-heading" className="text-sm font-semibold text-ink">
                Registros
              </h2>
              <p className="mt-0.5 text-xs text-muted" aria-live="polite">
                {result
                  ? `${result.total} ${
                      result.total === 1 ? 'registro' : 'registros'
                    }`
                  : 'Consultando la bitácora…'}
              </p>
            </div>
            {loading && result && (
              <span className="text-[11px] text-muted">Actualizando…</span>
            )}
          </header>

          {!result && loading && (
            <div aria-busy="true">
              <span className="sr-only">Cargando registros de auditoría…</span>
              <table className="w-full">
                <tbody>
                  <SkeletonRows rows={7} columns={5} />
                </tbody>
              </table>
            </div>
          )}

          {result && result.items.length === 0 && (
            <div className="p-5">
              <EmptyState
                title="Sin registros para estos filtros"
                description={
                  hasFilters
                    ? 'Prueba con un rango de fechas más amplio o quita algún criterio.'
                    : 'La bitácora se llenará a medida que se realicen acciones en la plataforma.'
                }
                action={
                  hasFilters ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={clearFilters}
                    >
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}

          {result && result.items.length > 0 && (
            <TableShell
              className="rounded-none border-0"
              footer={
                <Pager
                  page={result.page}
                  pageCount={pageCount}
                  busy={loading}
                  onPrev={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => current + 1)}
                />
              }
            >
              <table className="w-full min-w-[880px] border-collapse">
                <caption className="sr-only">
                  Registros de auditoría con fecha, actor, acción, objetivo e IP
                  de origen
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <Th className="px-5">Fecha</Th>
                    <Th>Actor</Th>
                    <Th>Acción</Th>
                    <Th>Objetivo</Th>
                    <Th className="px-5">IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((entry) => (
                    <tr
                      key={entry.logId}
                      className="border-b border-line/70 transition-colors duration-150 hover:bg-surface-2"
                    >
                      <Td className="whitespace-nowrap px-5 text-[11.5px] text-muted">
                        {TIMESTAMP_FORMAT.format(new Date(entry.timestamp))}
                      </Td>
                      <Td>
                        <span className="block text-[12.5px] text-ink">
                          {entry.actorName}
                        </span>
                        <span className="block font-mono text-[10.5px] text-muted">
                          {entry.actorId}
                        </span>
                      </Td>
                      <Td>
                        <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                          {entry.action}
                        </span>
                      </Td>
                      <Td className="font-mono text-[11px] text-muted">
                        {entry.targetId}
                      </Td>
                      <Td className="px-5 font-mono text-[11px] text-muted">
                        {entry.sourceIp}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </section>
      )}

      <Alert tone="info">
        La bitácora es append-only: cada registro conserva actor, fecha, objetivo
        e IP de origen, y no puede modificarse desde la aplicación.
      </Alert>
    </div>
  );
}
