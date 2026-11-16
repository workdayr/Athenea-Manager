'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';
import { SkeletonRows } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-provider';
import { formatDate, STATUS_LABELS, type DashboardUser } from '@/lib/dashboard';
import {
  archiveClosedProjects,
  archiveErrorMessage,
  archiveProject,
  fetchArchiveAlerts,
  fetchArchivedProjects,
  type ArchiveAlert,
  type ArchivedProjectPage,
} from '@/lib/archive';

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** RF-020: expedientes archivados, alertas y reintento manual. */
export default function AdminArchivePage() {
  return (
    <AuthedShell
      activeId="configuracion"
      searchPlaceholder="Buscar expedientes archivados…"
    >
      {(user) => <AdminArchiveContent user={user} />}
    </AuthedShell>
  );
}

function AdminArchiveContent({ user }: { user: DashboardUser }) {
  const toast = useToast();
  const canManage = user.role === 'ADMINISTRATOR';

  const [data, setData] = useState<ArchivedProjectPage | null>(null);
  const [alerts, setAlerts] = useState<ArchiveAlert[] | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [projectId, setProjectId] = useState('');
  const [projectIdError, setProjectIdError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<number | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const requestKey = `${page}|${reloadKey}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!canManage) {
      return;
    }
    const key = `${page}|${reloadKey}`;
    let active = true;
    Promise.all([
      fetchArchivedProjects(page),
      fetchArchiveAlerts(true),
    ])
      .then(([archived, alertRows]) => {
        if (!active) {
          return;
        }
        setData(archived);
        setAlerts(alertRows);
        setError(null);
        setLoadedKey(key);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setData(null);
        setAlerts(null);
        setError(archiveErrorMessage(loadError));
        setLoadedKey(key);
      });
    return () => {
      active = false;
    };
  }, [canManage, page, reloadKey]);

  async function runArchive(id: number) {
    setBusy(true);
    try {
      const outcome = await archiveProject(id);
      if (outcome.status === 'archived') {
        toast.success(
          `El proyecto #${id} quedó congelado en solo lectura.`,
          'Expediente archivado',
        );
        setProjectId('');
        setReloadKey((key) => key + 1);
      } else {
        toast.error(
          `No se archivó: ${outcome.reason ?? outcome.error ?? outcome.status}.`,
          'Archivado no completado',
        );
      }
    } catch (archiveError: unknown) {
      toast.error(
        archiveErrorMessage(archiveError),
        'No se pudo archivar el proyecto',
      );
    } finally {
      setBusy(false);
      setPendingArchive(null);
    }
  }

  async function runBatch() {
    setBusy(true);
    try {
      const summary = await archiveClosedProjects();
      toast.success(
        `${summary.archived} archivados · ${summary.skipped} omitidos · ${summary.failed} con error.`,
        'Barrido completado',
      );
      setReloadKey((key) => key + 1);
    } catch (batchError: unknown) {
      toast.error(
        archiveErrorMessage(batchError),
        'El barrido no pudo completarse',
      );
    } finally {
      setBusy(false);
      setBatchOpen(false);
    }
  }

  function handleRetry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(projectId);
    if (!Number.isInteger(id) || id <= 0) {
      setProjectIdError('Indica un identificador de proyecto válido.');
      return;
    }
    setProjectIdError(null);
    setPendingArchive(id);
  }

  if (!canManage) {
    return (
      <NoAccess
        title="Archivo institucional reservado"
        description="Solo la administración puede archivar expedientes y reintentar trabajos fallidos."
      />
    );
  }

  const pageCount = data ? Math.max(1, data.pageInfo.totalPages) : 1;
  const unresolvedAlerts = alerts ?? [];

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Configuración y auditoría', href: '/admin/audit' },
          { label: 'Expedientes archivados' },
        ]}
      />

      <PageHeader
        title="Expedientes archivados"
        description="Proyectos cerrados y congelados en solo lectura, con un snapshot verificable. El archivado no se puede revertir desde la plataforma."
        actions={
          <>
            <ButtonLink href="/admin/audit" variant="secondary" size="sm">
              Ver bitácora
            </ButtonLink>
            <Button
              size="sm"
              onClick={() => setBatchOpen(true)}
              disabled={busy}
              leadingIcon={<Icon name="stamp" className="h-4 w-4" />}
            >
              Archivar cerrados
            </Button>
          </>
        }
      />

      {unresolvedAlerts.length > 0 && (
        <Alert
          tone="warning"
          title={`${unresolvedAlerts.length} ${
            unresolvedAlerts.length === 1
              ? 'alerta de archivado'
              : 'alertas de archivado'
          } sin resolver`}
        >
          <ul className="space-y-1.5">
            {unresolvedAlerts.map((alert) => (
              <li key={alert.alertId} className="text-[12px]">
                <span className="font-medium">
                  Proyecto {alert.projectId ?? '(job global)'}
                </span>{' '}
                · {TIMESTAMP_FORMAT.format(new Date(alert.attemptedAt))} ·{' '}
                {alert.errorMessage}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <form onSubmit={handleRetry} noValidate>
        <SectionCard
          title="Reintentar archivado"
          description="Úsalo cuando un proyecto cerró pero el trabajo automático falló."
        >
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <div className="w-full max-w-[220px]">
              <Input
                id="archive-project-id"
                label="ID del proyecto"
                type="number"
                min={1}
                value={projectId}
                error={projectIdError ?? undefined}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setProjectIdError(null);
                }}
                placeholder="123"
              />
            </div>
            <Button type="submit" size="sm" disabled={busy || !projectId}>
              Archivar proyecto
            </Button>
          </div>
        </SectionCard>
      </form>

      {error && (
        <ErrorState
          className="min-h-[260px] justify-center bg-white"
          title="No pudimos cargar los expedientes"
          description={error}
          onRetry={() => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!error && (
        <section
          aria-labelledby="archive-heading"
          className="overflow-hidden rounded-xl border border-line bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="archive-heading" className="text-sm font-semibold text-ink">
                Expedientes congelados
              </h2>
              <p className="mt-0.5 text-xs text-muted" aria-live="polite">
                {data
                  ? `${data.total} ${
                      data.total === 1 ? 'expediente' : 'expedientes'
                    }`
                  : 'Consultando el archivo…'}
              </p>
            </div>
            {loading && data && (
              <span className="text-[11px] text-muted">Actualizando…</span>
            )}
          </header>

          {!data && loading && (
            <div aria-busy="true">
              <span className="sr-only">Cargando expedientes archivados…</span>
              <table className="w-full">
                <tbody>
                  <SkeletonRows rows={6} columns={4} />
                </tbody>
              </table>
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={<Icon name="stamp" className="h-5 w-5" />}
                title="Todavía no hay expedientes archivados"
                description="Cuando un proyecto se cierre, el barrido automático lo congelará aquí con su snapshot verificable."
              />
            </div>
          )}

          {data && data.items.length > 0 && (
            <TableShell
              className="rounded-none border-0"
              footer={
                <Pager
                  page={data.page}
                  pageCount={pageCount}
                  busy={loading}
                  onPrev={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => current + 1)}
                />
              }
            >
              <table className="w-full min-w-[780px] border-collapse">
                <caption className="sr-only">
                  Proyectos archivados con estado final, fecha de archivado y
                  hash del snapshot
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <Th className="px-5">Proyecto</Th>
                    <Th>Estado final</Th>
                    <Th>Archivado</Th>
                    <Th className="px-5">Hash del snapshot</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.projectId}
                      className="border-b border-line/70 transition-colors duration-150 hover:bg-surface-2"
                    >
                      <Td className="px-5">
                        <Link
                          href={`/projects/${item.projectId}`}
                          className="rounded text-[12.5px] font-medium text-ink transition-colors duration-150 hover:text-brand-700 hover:underline"
                        >
                          #{item.projectId} · {item.title}
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone="neutral">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] text-muted">
                        {formatDate(item.archivedAt)}
                      </Td>
                      <Td className="px-5">
                        <code
                          title={item.snapshotHash}
                          className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted"
                        >
                          {item.snapshotHash.slice(0, 16)}…
                        </code>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </section>
      )}

      <ConfirmDialog
        open={pendingArchive !== null}
        onClose={() => {
          if (!busy) {
            setPendingArchive(null);
          }
        }}
        onConfirm={() => {
          if (pendingArchive !== null) {
            void runArchive(pendingArchive);
          }
        }}
        title={`Archivar el proyecto #${pendingArchive ?? ''}`}
        description="El expediente quedará congelado en solo lectura con un snapshot verificable. No se puede revertir desde la plataforma."
        confirmLabel="Archivar expediente"
        cancelLabel="Cancelar"
        tone="danger"
        loading={busy}
      />

      <ConfirmDialog
        open={batchOpen}
        onClose={() => {
          if (!busy) {
            setBatchOpen(false);
          }
        }}
        onConfirm={() => void runBatch()}
        title="Archivar todos los proyectos cerrados"
        description="El barrido recorre los proyectos cerrados y congela cada uno en solo lectura. Los que no cumplan los requisitos se omiten y quedan registrados en la bitácora."
        confirmLabel="Ejecutar barrido"
        cancelLabel="Cancelar"
        tone="danger"
        loading={busy}
      />
    </div>
  );
}
