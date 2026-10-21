'use client';

import { useMemo, useState } from 'react';
import { Icon } from './icons';
import { KpiCard } from './kpi-card';
import { LifecycleFunnel } from './lifecycle-funnel';
import {
  DEPARTMENT_SHARES,
  SLA_LABELS,
  STATUS_LABELS,
  formatDate,
  institutionalLifecycle,
  initials,
  visibleKpis,
  visiblePriorityProjects,
  type DashboardUser,
  type PriorityProject,
  type SlaStatus,
} from '@/lib/dashboard';

const PAGE_SIZE = 5;

/** Estado(s) de proyecto que corresponden a cada etapa del ciclo de vida. */
const PHASE_STATUSES: Record<number, string[]> = {
  1: ['Proposed'],
  2: ['Under_Review'],
  3: ['Approved', 'Rejected'],
  4: ['Active', 'Suspended'],
  5: ['Completed', 'Closed'],
};

const SLA_STYLES: Record<SlaStatus, string> = {
  on_track: 'border-brand-100 bg-[#eef2fb] text-brand-800',
  at_risk: 'border-red-200 bg-red-50 text-red-700',
  upcoming: 'border-line bg-[#f1f3f9] text-muted',
};

const SLA_DOT: Record<SlaStatus, string> = {
  on_track: 'bg-brand-500',
  at_risk: 'bg-red-500',
  upcoming: 'bg-[#9aa5bb]',
};

/**
 * Tablero de Control Institucional (UC-009 / RF-008).
 *
 * RF-001: los KPI, la tabla y el detalle presupuestal se filtran por rol.
 * El Comité solo ve propuestas en dictamen y no accede a cifras de
 * presupuesto; coordinación y administración ven el inventario completo.
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
  const lifecycle = useMemo(() => institutionalLifecycle(), []);
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('all');
  const [call, setCall] = useState('all');
  const [page, setPage] = useState(1);
  const [year, setYear] = useState('2026');

  const kpis = visibleKpis(user.role);
  const canSeeBudget =
    user.role === 'ADMINISTRATOR' || user.role === 'COORDINATOR';

  const roleProjects = useMemo(
    () => visiblePriorityProjects(user.role),
    [user.role],
  );

  const departments = useMemo(
    () => unique(roleProjects.map((project) => project.department)),
    [roleProjects],
  );

  const statuses = useMemo(
    () => unique(roleProjects.map((project) => project.projectStatus)),
    [roleProjects],
  );

  const calls = useMemo(
    () =>
      unique(
        roleProjects.map((project) => project.call.split(' · ')[0] ?? project.call),
      ),
    [roleProjects],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return roleProjects.filter((project) => {
      if (phaseFilter) {
        const allowed = PHASE_STATUSES[phaseFilter] ?? [];
        if (!allowed.includes(project.projectStatus)) {
          return false;
        }
      }
      if (department !== 'all' && project.department !== department) {
        return false;
      }
      if (status !== 'all' && project.projectStatus !== status) {
        return false;
      }
      if (call !== 'all' && !project.call.startsWith(call)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [
        project.id,
        project.title,
        project.pi,
        project.department,
        project.milestone,
        project.call,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [roleProjects, query, phaseFilter, department, status, call]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function handlePhaseSelect(phaseId: number) {
    setPhaseFilter((current) => (current === phaseId ? null : phaseId));
    setPage(1);
  }

  function handleExport() {
    // RF-008: la exportacion ejecutiva PDF/XLSX queda pendiente; por ahora
    // se entrega el mismo inventario filtrado en CSV (compatible con Excel).
    const header = [
      'Clave',
      'Titulo',
      'Investigador',
      'Departamento',
      'Hito actual',
      'Vencimiento',
      'Semaforo',
      'Estado',
    ];
    const rows = filtered.map((project) => [
      project.id,
      project.title,
      project.pi,
      project.department,
      project.milestone,
      formatDate(project.dueDate),
      SLA_LABELS[project.sla],
      STATUS_LABELS[project.projectStatus] ?? project.projectStatus,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `athenea-proyectos-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          UNIPOLI · Vicerrectoría de I+D+I ·{' '}
          <span className="text-brand-700">Ciclo {year}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10.5px] font-medium text-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Datos de ejemplo (RF-008 en integración)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            P95 &lt; 3s (RF-013)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            <Icon name="eye" className="h-3 w-3" />
            Vista: {roleScopeLabel(user.role)}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-start xl:justify-between">
          <div className="min-w-0 xl:min-w-[520px] xl:flex-1">
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
              Tablero de Control Institucional
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
              Supervisión estratégica de protocolos, comités evaluadores, metas
              SLA y ejercicio de fondos.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5 xl:ml-auto">
            <label className="sr-only" htmlFor="dashboard-year">
              Ciclo activo
            </label>
            <select
              id="dashboard-year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="h-9 rounded-md border border-line bg-white px-3 pr-8 text-xs font-medium text-ink focus:border-brand-300 focus:outline-none"
            >
              <option value="2026">Año en Curso 2026 (Ciclo Activo)</option>
              <option value="2025">Ciclo 2025 (Cerrado)</option>
              <option value="2024">Ciclo 2024 (Cerrado)</option>
            </select>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800"
              title="Exporta el inventario filtrado en CSV (PDF/XLSX pendiente, RF-008)"
            >
              <Icon name="download" className="h-4 w-4" />
              Exportar Informe Ejecutivo
              <span className="text-[10px] font-medium text-white/70">
                PDF / XLSX
              </span>
            </button>
          </div>
        </div>
      </header>

      <section
        aria-label="Indicadores institucionales"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                Distribución por Departamento Académico
              </h2>
              <p className="mt-1 text-[11.5px] text-muted">
                Volumen y asignación porcentual de iniciativas científicas
                activas
              </p>
            </div>
            <span className="rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10.5px] font-medium text-brand-800">
              4 Unidades Clave
            </span>
          </div>

          <ul className="mt-5 space-y-4">
            {DEPARTMENT_SHARES.map((item) => (
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
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eef1f7]">
                  <div
                    className={`h-full rounded-full ${item.barClassName}`}
                    style={{ width: `${item.share}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {canSeeBudget && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-[#f8f9fd] px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-[11.5px] text-ink">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-brand-700">
                  <Icon name="folder" className="h-4 w-4" />
                </span>
                <span className="truncate">
                  Mayor concentración de financiamiento:{' '}
                  <strong className="font-semibold">
                    Software &amp; Algoritmos IA (44.2%)
                  </strong>
                </span>
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                title="Detalle presupuestal: módulo pendiente de implementación"
              >
                Ver detalle presupuestal
                <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </span>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Embudo del Ciclo de Vida
            </h2>
            <span className="shrink-0 text-[10px] font-medium text-muted">
              RF-002 a RF-007
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

      <section className="rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Seguimiento de Proyectos Prioritarios
            </h2>
            <p className="mt-1 text-[11.5px] text-muted">
              Inventario dinámico y estado de cumplimiento de compromisos
              pactados (SLA / RF-006)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-line bg-[#f8f9fd] px-2.5 py-1 text-[10.5px] font-medium text-muted">
              {filtered.length} registros cargados
            </span>
            <button
              type="button"
              onClick={() => setPage(1)}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted transition hover:text-brand-700"
              aria-label="Actualizar vista de proyectos"
              title="Actualizar vista"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
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
              placeholder="Búsqueda FTS: título, protocolo, PI o palabras clave…"
              className="h-9 w-full rounded-md border border-line bg-[#f8f9fd] pl-8 pr-3 text-[11.5px] text-ink placeholder:text-muted focus:border-brand-300 focus:bg-white focus:outline-none"
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <FilterSelect
            label="Área"
            value={department}
            onChange={(value) => {
              setDepartment(value);
              setPage(1);
            }}
            options={departments.map((item) => ({ value: item, label: item }))}
            allLabel="Todas las Áreas"
          />
          <FilterSelect
            label="Estado"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={statuses.map((item) => ({
              value: item,
              label: STATUS_LABELS[item] ?? item,
            }))}
            allLabel="Todos los Estados"
          />
          <FilterSelect
            label="Convocatoria"
            value={call}
            onChange={(value) => {
              setCall(value);
              setPage(1);
            }}
            options={calls.map((item) => ({ value: item, label: item }))}
            allLabel="Convocatoria: Todas"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <caption className="sr-only">
              Proyectos prioritarios con su investigador principal,
              departamento, hito actual y semáforo SLA
            </caption>
            <thead>
              <tr className="border-y border-line bg-[#f8f9fd] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
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
                  Departamento
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Hito actual
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Semáforo
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-[12px] text-muted"
                  >
                    No hay proyectos que coincidan con los filtros
                    seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-[11px] text-muted">
            Mostrando{' '}
            <strong className="font-semibold text-ink">
              {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)}
            </strong>{' '}
            de {filtered.length} proyectos
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-line bg-[#f8f9fd] px-2 py-1 text-[10px] font-medium text-muted">
              Paginación cliente ({PAGE_SIZE}/página)
            </span>
            <div className="flex items-center gap-1">
              <PagerButton
                label="Página anterior"
                disabled={safePage === 1}
                onClick={() => setPage(safePage - 1)}
                glyph="‹"
              />
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    aria-current={pageNumber === safePage ? 'page' : undefined}
                    className={`h-7 min-w-7 rounded-md px-2 text-[11px] font-semibold transition ${
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
                disabled={safePage === totalPages}
                onClick={() => setPage(safePage + 1)}
                glyph="›"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-3 rounded-xl border border-line bg-[#f1f5fd] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
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
            forzosa · Auditoría inmutable activa (RF-017)
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
    <tr className="border-b border-line/70 align-top transition hover:bg-[#fafbfe]">
      <td className="px-5 py-3.5">
        <span className="whitespace-nowrap text-[10.5px] font-semibold tracking-wide text-brand-700">
          {project.id}
        </span>
      </td>
      <td className="max-w-[320px] px-3 py-3.5">
        <p className="text-[12px] font-semibold leading-snug text-ink">
          {project.title}
        </p>
        <p className="mt-1 text-[10.5px] leading-snug text-muted">
          {project.call}
        </p>
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
      <td className="px-3 py-3.5 text-[11px] text-muted">
        {project.department}
      </td>
      <td className="px-3 py-3.5">
        <p
          className={`text-[11.5px] font-medium leading-snug ${
            isLate ? 'text-red-700' : 'text-ink'
          }`}
        >
          {project.milestone}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          {isLate
            ? `Expiró hace ${project.daysLate ?? 0} días (RF-006)`
            : `Vence: ${formatDate(project.dueDate)}`}
        </p>
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
        className="h-9 rounded-md border border-line bg-white px-2.5 text-[11px] font-medium text-ink focus:border-brand-300 focus:outline-none"
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
    return 'Comité (solo dictámenes)';
  }
  if (role === 'COORDINATOR') {
    return 'Coordinación';
  }
  return 'Administración';
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Referencia usada por el buscador superior cuando el rol es institucional. */
export const ADMIN_SEARCH_PLACEHOLDER =
  'Búsqueda global FTS: proyectos, protocolos, comités...';
