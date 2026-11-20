'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';
import { useQuery } from '@apollo/client/react';
import { Icon } from './icons';
import { KpiCard } from './kpi-card';
import { LifecycleFunnel } from './lifecycle-funnel';
import {
  SLA_LABELS,
  STATUS_LABELS,
  formatCurrency,
  formatDate,
  initials,
  institutionalLifecycle,
  type DashboardUser,
  type PriorityProject,
  type SlaStatus,
} from '@/lib/dashboard';
import {
  COORDINATOR_DASHBOARD_QUERY,
  PHASE_STATUSES,
  buildDashboardKpis,
  dashboardLifecycle,
  downloadCoordinatorReport,
  mapDashboardProject,
  statusShares,
  type CoordinatorDashboardData,
  type CoordinatorDashboardResult,
  type ReportFiltersInput,
} from '@/lib/reporting';
import { getApolloClient, graphqlErrorCode } from '@/lib/apollo-client';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const SLA_STYLES: Record<SlaStatus, string> = {
  on_track: 'border-info-line bg-info-soft text-brand-800',
  at_risk: 'border-danger-line bg-danger-soft text-danger',
  upcoming: 'border-line bg-surface-3 text-muted',
  no_milestones: 'border-line bg-white text-muted',
};

const SLA_DOT: Record<SlaStatus, string> = {
  on_track: 'bg-brand-500',
  at_risk: 'bg-danger',
  upcoming: 'bg-muted/60',
  no_milestones: 'bg-line-strong',
};

const TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : TIME_FORMATTER.format(date);
}

function errorMessage(error: unknown): string {
  const code = graphqlErrorCode(error);
  if (code === 'REPORTING_UNAVAILABLE') {
    return 'No se pudieron calcular las métricas del tablero. Intenta de nuevo en unos segundos.';
  }
  if (code === 'VALIDATION_ERROR') {
    return 'Los filtros seleccionados no son válidos. Ajusta el periodo e intenta de nuevo.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo cargar el tablero institucional.';
}

/** Ventana de paginas visible alrededor de la pagina actual. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) {
      result.push('gap');
    }
    result.push(page);
    previous = page;
  }
  return result;
}

/**
 * Tablero de Control Institucional.
 *
 * Los KPI, la tabla y el detalle presupuestal se filtran por rol.
 * El Comité solo ve propuestas en dictamen y no accede a cifras de
 * presupuesto; coordinación y administración ven el inventario completo.
 *
 * Los datos provienen de `coordinatorDashboard`, que
 * pagina del lado del servidor y cachea los cálculos durante 15 minutos.
 */
export function AdminDashboard({
  user,
  query,
  onSearchChange,
}: {
  user: DashboardUser;
  query: string;
  onSearchChange: (value: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [status, setStatus] = useState('all');
  const [call, setCall] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const toast = useToast();
  const client = useMemo(() => getApolloClient(), []);

  const canSeeBudget =
    user.role === 'ADMINISTRATOR' || user.role === 'COORDINATOR';

  useEffect(() => {
    // Evita una consulta por cada tecla; el debounce solo aplica a
    // la busqueda de la tabla, no a los KPI (que ignoran ese filtro).
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const statuses = useMemo(() => {
    const phaseStatuses = phaseFilter
      ? (PHASE_STATUSES[phaseFilter] ?? [])
      : null;
    if (status !== 'all') {
      return phaseStatuses
        ? phaseStatuses.filter((item) => item === status)
        : [status];
    }
    return phaseStatuses ?? [];
  }, [phaseFilter, status]);

  const requestedPage = page;
  const filters: ReportFiltersInput = {
    year,
    page: requestedPage,
    pageSize: PAGE_SIZE,
    ...(call !== 'all' ? { callId: Number(call) } : {}),
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(search ? { search } : {}),
  };

  const {
    data: queryResult,
    loading,
    error: queryError,
    refetch,
  } = useQuery<CoordinatorDashboardResult>(COORDINATOR_DASHBOARD_QUERY, {
    client,
    variables: { filters },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    returnPartialData: false,
  });

  // Apollo Client 4 tipa `data` como DeepPartial porque la cache podria
  // contener una respuesta incompleta. La consulta solicita todos los campos
  // y `returnPartialData: false` garantiza respuestas completas, por lo que
  // se restaura el tipo del contrato en este limite.
  const data = (queryResult?.coordinatorDashboard ??
    null) as CoordinatorDashboardData | null;
  const error = queryError ? errorMessage(queryError) : null;

  const metrics = data?.metrics ?? null;
  const kpis = useMemo(
    () => (metrics ? buildDashboardKpis(metrics, user.role, year) : []),
    [metrics, user.role, year],
  );
  const shares = useMemo(
    () => (metrics ? statusShares(metrics) : []),
    [metrics],
  );
  const lifecycle = useMemo(
    () => (metrics ? dashboardLifecycle(metrics) : institutionalLifecycle()),
    [metrics],
  );
  const rows = useMemo(
    () => (data?.projects ?? []).map(mapDashboardProject),
    [data],
  );

  const callOptions = data?.callOptions ?? [];
  const totalFiltered = data?.totalFilteredProjects ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, totalFiltered);
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);
  const statusOptions = useMemo(() => {
    const allowedStatuses = phaseFilter
      ? (PHASE_STATUSES[phaseFilter] ?? [])
      : null;
    const counts = metrics?.statusCounts ?? [];
    const options = counts
      .filter(
        (item) =>
          item.count > 0 &&
          (!allowedStatuses || allowedStatuses.includes(item.status)),
      )
      .map((item) => ({
        value: item.status,
        label: `${STATUS_LABELS[item.status] ?? item.status} (${item.count})`,
      }));
    // Conserva visible el estado elegido aunque ya no tenga registros en el
    // periodo, para que el filtro activo no parezca vacio.
    if (status !== 'all' && !options.some((option) => option.value === status)) {
      options.unshift({
        value: status,
        label: STATUS_LABELS[status] ?? status,
      });
    }
    return options;
  }, [metrics, phaseFilter, status]);

  function handlePhaseSelect(phaseId: number) {
    const next = phaseFilter === phaseId ? null : phaseId;
    setPhaseFilter(next);
    if (
      next &&
      status !== 'all' &&
      !(PHASE_STATUSES[next] ?? []).includes(status)
    ) {
      setStatus('all');
    }
    setPage(1);
  }

  async function handleExport(format: 'csv' | 'pdf') {
    // El servidor genera el archivo con TODOS los registros
    // que cumplen los filtros (no solo la pagina visible) y aplica la
    // visibilidad por rol, incluido el presupuesto oculto al Comité.
    setExporting(format);
    try {
      await downloadCoordinatorReport(filters, format);
      toast.success(
        `Informe ${format.toUpperCase()} generado con los filtros activos.`,
        'Exportación lista',
      );
    } catch (exportError) {
      toast.error(
        exportError instanceof Error
          ? exportError.message
          : 'No fue posible exportar el reporte. Intenta de nuevo.',
        'No se pudo exportar',
      );
    } finally {
      setExporting(null);
    }
  }

  const hasFilters =
    phaseFilter !== null || status !== 'all' || call !== 'all' || search.length > 0;

  function clearFilters() {
    setPhaseFilter(null);
    setStatus('all');
    setCall('all');
    setSearch('');
    onSearchChange('');
    setPage(1);
  }

  if (!metrics && loading) {
    return <AdminDashboardSkeleton />;
  }

  if (!metrics && error) {
    return (
      <ErrorState
        className="min-h-[420px] justify-center bg-white"
        title="No pudimos cargar el tablero"
        description={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <PageHeader
          title="Tablero de Control Institucional"
          description="Supervisión estratégica de protocolos, comités evaluadores, metas SLA y ejercicio de fondos."
          actions={
            <>
              <label className="sr-only" htmlFor="dashboard-year">
                Ciclo activo
              </label>
              <select
                id="dashboard-year"
                value={year}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line-strong bg-white px-3 pr-8 text-xs font-medium text-ink transition-colors duration-150 hover:border-brand-300 focus:border-brand-400"
              >
                {yearOptions.map((option, index) => (
                  <option key={option} value={option}>
                    {index === 0
                      ? `Ciclo ${option} (activo)`
                      : `Ciclo ${option} (cerrado)`}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={() => void handleExport('csv')}
                loading={exporting === 'csv'}
                disabled={rows.length === 0 || exporting !== null}
                leadingIcon={<Icon name="download" className="h-4 w-4" />}
                title="Exporta todos los proyectos que cumplen los filtros en CSV"
              >
                {exporting === 'csv' ? 'Exportando…' : 'Informe CSV'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleExport('pdf')}
                loading={exporting === 'pdf'}
                disabled={rows.length === 0 || exporting !== null}
                leadingIcon={<Icon name="download" className="h-4 w-4" />}
                title="Descarga el informe ejecutivo en PDF con los mismos filtros"
              >
                {exporting === 'pdf' ? 'Exportando…' : 'PDF'}
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${
              data?.fromCache
                ? 'border-info-line bg-info-soft text-brand-800'
                : 'border-success-line bg-success-soft text-success'
            }`}
            title={
              data
                ? `Generado: ${formatDateTime(data.generatedAt)} · Válido hasta: ${formatDateTime(data.cacheExpiresAt)}`
                : undefined
            }
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                data?.fromCache ? 'bg-brand-500' : 'bg-success'
              }`}
            />
            {data?.fromCache ? 'Caché activa (≤ 15 min)' : 'Datos en vivo'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            P95 &lt; 3 s
            {data && (
              <strong className="font-semibold text-ink">
                · {Math.max(0, Math.round(data.computationMs))} ms
              </strong>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            <Icon name="eye" className="h-3 w-3" />
            Vista: {roleScopeLabel(user.role)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            Ciclo {year}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-2.5 py-1 text-[10.5px] font-medium text-warning">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Actualizando…
            </span>
          )}
        </div>
      </div>

      {error && metrics && (
        <Alert
          tone="danger"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void refetch();
              }}
            >
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <section
        aria-label="Indicadores institucionales"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                Distribución por Estado del Proyecto
              </h2>
              <p className="mt-1 text-[11.5px] text-muted">
                Volumen y participación porcentual del inventario en el periodo
                seleccionado
              </p>
            </div>
            <span className="rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10.5px] font-medium text-brand-800">
              {metrics?.totalProjects ?? 0} proyectos
            </span>
          </div>

          {shares.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {shares.map((item) => (
                <li key={item.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-ink">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-sm ${item.barClassName}`}
                      />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted">
                      <strong className="font-semibold text-ink">
                        {item.projects}
                      </strong>{' '}
                      proyectos ({item.share}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-snappy ${item.barClassName}`}
                      style={{ width: `${item.share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              className="mt-5"
              title="Sin proyectos en el periodo"
              description="No hay proyectos registrados para el ciclo seleccionado."
            />
          )}

          {canSeeBudget && metrics && metrics.budget.spent !== null ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-[11.5px] text-ink">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-brand-700">
                  <Icon name="wallet" className="h-4 w-4" />
                </span>
                <span className="truncate">
                  Presupuesto ejercido:{' '}
                  <strong className="font-semibold">
                    {formatCurrency(metrics?.budget.spent ?? 0)}
                  </strong>{' '}
                  · {metrics?.budget.expenseCount ?? 0} gastos registrados
                </span>
              </span>
              <span className="text-[10.5px] font-medium text-muted">
                {metrics?.budget.budgetEnabledProjects ?? 0} proyectos con
                presupuesto habilitado
              </span>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[10.5px] text-muted">
              Vista de Comité: las cifras presupuestales están restringidas por
              rol.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Embudo del Ciclo de Vida
            </h2>
            <span className="shrink-0 text-[10px] font-medium text-muted">
              Todas las etapas
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted">
            Interacción de expedientes entre comités y fases operativas
          </p>

          <div className="mt-4">
            <LifecycleFunnel
              model={lifecycle}
              mode="institutional"
              selectedId={phaseFilter}
              onSelect={handlePhaseSelect}
            />
          </div>

          <p className="mt-4 text-center text-[10.5px] leading-relaxed text-muted">
            {phaseFilter
              ? 'Etapa seleccionada: la tabla inferior muestra solo esos registros. Vuelve a hacer clic para quitar el filtro.'
              : 'Haz clic en una etapa para filtrar los registros de la vista inferior.'}
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Seguimiento de Proyectos Prioritarios
            </h2>
            <p className="mt-1 text-[11.5px] text-muted">
              Inventario dinámico y estado de cumplimiento de compromisos
              pactados (SLA)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium text-muted" aria-live="polite">
              {totalFiltered} registros
            </span>
            <button
              type="button"
              onClick={() => {
                void refetch();
              }}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted transition hover:text-brand-700"
              aria-label="Actualizar vista de proyectos"
              title="Volver a consultar el tablero"
            >
              <Icon
                name="refresh"
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 px-5">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Buscar proyecto en la tabla</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            />
            <input
              aria-label="Buscar proyecto"
              placeholder="Buscar por título o investigador principal…"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 pl-8 pr-3 text-[11.5px] text-ink transition-colors duration-150 placeholder:text-muted hover:border-brand-300 focus:border-brand-400 focus:bg-white"
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <FilterSelect
            label="Estado"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={statusOptions}
            allLabel="Todos los Estados"
          />
          <FilterSelect
            label="Convocatoria"
            value={call}
            onChange={(value) => {
              setCall(value);
              setPage(1);
            }}
            options={callOptions.map((option) => ({
              value: option.callId,
              label: option.title,
            }))}
            allLabel="Convocatoria: Todas"
          />
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearFilters}
              className="text-xs"
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <caption className="sr-only">
              Proyectos prioritarios con su investigador principal,
              convocatoria, hito actual, estado y semáforo SLA
            </caption>
            <thead>
              <tr className="border-y border-line bg-surface-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-5 py-2.5">
                  Clave / ID
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Título del proyecto
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Investigador (PI)
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Convocatoria
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Hito actual
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Estado
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Semáforo
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <SkeletonRows rows={4} columns={7} />
              )}
              {rows.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10">
                    <EmptyState
                      compact
                      title="No hay proyectos que coincidan con los filtros"
                      description="Prueba con otro estado, otra convocatoria o limpia los filtros activos."
                      action={
                        hasFilters ? (
                          <Button size="sm" variant="secondary" onClick={clearFilters}>
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-[11px] text-muted" aria-live="polite">
            Mostrando{' '}
            <strong className="font-semibold text-ink">
              {pageStart}–{pageEnd}
            </strong>{' '}
            de {totalFiltered} proyectos
            {data && (
              <span className="ml-2 text-[10px]">
                · generado {formatDateTime(data.generatedAt)}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[10px] font-medium text-muted">
              Paginación servidor ({PAGE_SIZE}/página)
            </span>
            <div className="flex items-center gap-1">
              <PagerButton
                label="Página anterior"
                disabled={safePage <= 1 || loading}
                onClick={() => setPage(Math.max(1, safePage - 1))}
                glyph="‹"
              />
              {pageWindow(safePage, totalPages).map((pageNumber, index) =>
                pageNumber === 'gap' ? (
                  <span
                    key={`gap-${index}`}
                    className="px-1 text-[11px] text-muted"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                    aria-current={pageNumber === safePage ? 'page' : undefined}
                    className={`h-7 min-w-7 rounded-md px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      pageNumber === safePage
                        ? 'bg-brand-800 text-white'
                        : 'border border-line bg-white text-ink hover:bg-brand-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <PagerButton
                label="Página siguiente"
                disabled={safePage >= totalPages || loading}
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                glyph="›"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-3 rounded-xl border border-line bg-brand-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-brand-700">
            <Icon name="shield" className="h-4 w-4" />
          </span>
          <p className="text-[10.5px] leading-relaxed text-muted">
            <strong className="font-semibold text-ink">
              Cumplimiento LFPDPPP Activo
            </strong>{' '}
            · UNIPOLI Vicerrectoría
            <br />
            Cifrado AES-256-GCM en reposo · Tokens de sesión con caducidad
            forzosa · Auditoría inmutable activa
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            SHA-256 Logs Válidos
          </span>
          <span className="rounded-full border border-line bg-white px-2 py-0.5 font-medium">
            v2.4.0-prod
          </span>
        </div>
      </footer>
    </div>
  );
}

function ProjectRow({ project }: { project: PriorityProject }) {
  const isLate = project.sla === 'at_risk';

  return (
    <tr className="border-b border-line/70 align-top transition-colors duration-150 hover:bg-surface-2">
      <td className="px-5 py-3.5">
        <span className="whitespace-nowrap text-[10.5px] font-semibold tracking-wide text-brand-700">
          {project.id}
        </span>
      </td>
      <td className="max-w-[320px] px-3 py-3.5">
        <Link
          href={`/projects/${project.projectId}`}
          className="group inline-flex items-start gap-1 rounded text-[12px] font-semibold leading-snug text-ink transition-colors duration-150 hover:text-brand-700"
        >
          <span className="underline-offset-2 group-hover:underline">
            {project.title}
          </span>
          <Icon
            name="chevronRight"
            className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </Link>
      </td>
      <td className="px-3 py-3.5">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[9.5px] font-semibold text-brand-800">
            {initials(project.pi)}
          </span>
          <span className="whitespace-nowrap text-[11.5px] text-ink">
            {project.pi}
          </span>
        </span>
      </td>
      <td className="max-w-[190px] px-3 py-3.5 text-[11px] text-muted">
        <span className="line-clamp-2">{project.call}</span>
      </td>
      <td className="px-3 py-3.5">
        <p
          className={`text-[11.5px] font-medium leading-snug ${
            isLate ? 'text-danger' : 'text-ink'
          }`}
        >
          {project.milestone}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          {isLate
            ? `Expiró hace ${project.daysLate ?? 0} días`
            : project.sla === 'no_milestones'
              ? `Fin del proyecto: ${formatDate(project.dueDate)}`
              : `Vence: ${formatDate(project.dueDate)}`}
        </p>
      </td>
      <td className="px-3 py-3.5">
        <span className="inline-flex whitespace-nowrap rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-ink">
          {STATUS_LABELS[project.projectStatus] ?? project.projectStatus}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium ${SLA_STYLES[project.sla]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${SLA_DOT[project.sla]}`}
          />
          {SLA_LABELS[project.sla]}
        </span>
      </td>
    </tr>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Cargando tablero institucional…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-3 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="rounded-xl border border-line bg-white p-5">
          <Skeleton className="h-4 w-56" />
          <div className="mt-5 space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="mt-2 h-2 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Skeleton className="h-4 w-48" />
          <div className="mt-5 space-y-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <Skeleton className="h-4 w-64" />
        </div>
        <table className="w-full">
          <tbody>
            <SkeletonRows rows={5} columns={6} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-line-strong bg-white px-2.5 text-[11px] font-medium text-ink transition-colors duration-150 hover:border-brand-300 focus:border-brand-400"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  glyph,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  glyph: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md border border-line bg-white text-[12px] text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {glyph}
    </button>
  );
}

function roleScopeLabel(role: DashboardUser['role']): string {
  if (role === 'COMMITTEE') {
    return 'Comité (sin presupuesto)';
  }
  if (role === 'COORDINATOR') {
    return 'Coordinación';
  }
  return 'Administración';
}

/** Referencia usada por el buscador superior cuando el rol es institucional. */
export const ADMIN_SEARCH_PLACEHOLDER =
  'Buscar por proyecto, investigador o convocatoria...';
