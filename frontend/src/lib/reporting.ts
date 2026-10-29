import { gql } from '@apollo/client';
import {
  STATUS_LABELS,
  formatCurrency,
  formatPercent,
  type InstitutionalKpi,
  type LifecycleModel,
  type PlatformRole,
  type PriorityProject,
  type SlaStatus,
  institutionalLifecycle,
} from './dashboard';

/**
 * Operaciones y mapeo del dashboard institucional (RF-008 / UC-009).
 *
 * El backend calcula los KPI y aplica paginacion del lado del servidor con
 * cache de 15 minutos; este modulo solo transforma la respuesta GraphQL al
 * modelo de presentacion que consumen las tarjetas, el embudo y la tabla.
 */

export const COORDINATOR_DASHBOARD_QUERY = gql`
  query CoordinatorDashboard($filters: ReportFiltersInput) {
    coordinatorDashboard(filters: $filters) {
      metrics {
        totalProjects
        statusCounts {
          status
          count
        }
        activeProjects
        completedProjects
        delayedProjects
        budget {
          spent
          expenseCount
          budgetEnabledProjects
        }
        productivity {
          milestonesTotal
          milestonesCompleted
          milestonesDelayed
          completionRate
          researchProducts
          activeResearchers
          productsPerActiveProject
        }
        decisions {
          total
          approved
          rejected
          revisionRequested
          approvalRate
        }
      }
      projects {
        projectId
        title
        status
        piName
        callTitle
        startDate
        endDate
        currentMilestone
        currentMilestoneDueDate
        slaStatus
        daysLate
      }
      callOptions {
        callId
        title
      }
      totalFilteredProjects
      page
      pageSize
      totalPages
      range {
        from
        to
      }
      generatedAt
      cacheExpiresAt
      fromCache
      computationMs
    }
  }
`;

export interface ReportFiltersInput {
  year?: number;
  from?: string;
  to?: string;
  statuses?: string[];
  callId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DashboardStatusCount {
  status: string;
  count: number;
}

export interface DashboardBudgetMetrics {
  /** null cuando el rol no tiene acceso presupuestal (Comite). */
  spent: number | null;
  expenseCount: number | null;
  budgetEnabledProjects: number;
}

export interface DashboardProductivityMetrics {
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesDelayed: number;
  completionRate: number;
  researchProducts: number;
  activeResearchers: number;
  productsPerActiveProject: number;
}

export interface DashboardDecisionMetrics {
  total: number;
  approved: number;
  rejected: number;
  revisionRequested: number;
  approvalRate: number;
}

export interface DashboardMetrics {
  totalProjects: number;
  statusCounts: DashboardStatusCount[];
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  budget: DashboardBudgetMetrics;
  productivity: DashboardProductivityMetrics;
  decisions: DashboardDecisionMetrics;
}

export interface DashboardProject {
  projectId: string;
  title: string;
  status: string;
  piName: string | null;
  callTitle: string | null;
  startDate: string;
  endDate: string;
  currentMilestone: string | null;
  currentMilestoneDueDate: string | null;
  slaStatus: string;
  daysLate: number | null;
}

export interface CallOption {
  callId: string;
  title: string;
}

export interface CoordinatorDashboardData {
  metrics: DashboardMetrics;
  projects: DashboardProject[];
  callOptions: CallOption[];
  totalFilteredProjects: number;
  page: number;
  pageSize: number;
  totalPages: number;
  range: { from: string; to: string };
  generatedAt: string;
  cacheExpiresAt: string;
  fromCache: boolean;
  computationMs: number;
}

export interface CoordinatorDashboardResult {
  coordinatorDashboard: CoordinatorDashboardData;
}

/* -------------------------------------------------------------------------- */
/* KPIs                                                                       */
/* -------------------------------------------------------------------------- */

const STATUS_CHIP_ORDER = ['Proposed', 'Under_Review', 'Active', 'Completed'];

function statusChips(metrics: DashboardMetrics) {
  const byStatus = new Map(
    metrics.statusCounts.map((item) => [item.status, item.count]),
  );
  const chips = STATUS_CHIP_ORDER.map((status) => ({
    label: String(byStatus.get(status) ?? 0),
    value: STATUS_LABELS[status] ?? status,
  }));
  return chips.some((chip) => chip.label !== '0') ? chips : undefined;
}

/**
 * RF-001 / RF-008: construye las tarjetas KPI segun el rol.
 *
 * Coordinacion y administracion ven el presupuesto ejercido; el Comite no
 * (el backend devuelve `spent = null`), por lo que en su lugar se muestra el
 * volumen de dictamenes emitidos.
 */
export function buildDashboardKpis(
  metrics: DashboardMetrics,
  role: PlatformRole,
  year: number,
): InstitutionalKpi[] {
  const kpis: InstitutionalKpi[] = [
    {
      id: 'projects',
      label: 'Proyectos totales registrados',
      value: String(metrics.totalProjects),
      caption: `Del ciclo ${year}`,
      icon: 'grid',
      chips: statusChips(metrics),
      roles: ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'],
    },
    {
      id: 'productivity',
      label: 'Productividad cientifica',
      value: formatPercent(metrics.productivity.completionRate),
      caption: `${metrics.productivity.milestonesCompleted} de ${metrics.productivity.milestonesTotal} hitos completados`,
      icon: 'gauge',
      progress: {
        prefix: `${metrics.productivity.researchProducts} productos`,
        highlight: `${metrics.productivity.activeResearchers} investigadores`,
        suffix: `${metrics.productivity.productsPerActiveProject.toFixed(1)} prod/proy.`,
        percent: metrics.productivity.completionRate,
      },
      roles: ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'],
    },
    {
      id: 'risk',
      label: 'Hitos y entregas en riesgo',
      value: String(metrics.productivity.milestonesDelayed),
      caption: `${metrics.delayedProjects} proyecto(s) con retraso crítico`,
      icon: 'alert',
      alert:
        metrics.productivity.milestonesDelayed > 0
          ? 'Alerta automatizada (Cron > 7 días, RF-006). Revisa el seguimiento de hitos.'
          : undefined,
      roles: ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'],
    },
  ];

  if (role !== 'COMMITTEE' && metrics.budget.spent !== null) {
    kpis.push({
      id: 'budget',
      label: 'Presupuesto ejercido I+D',
      value: formatCurrency(metrics.budget.spent),
      caption: `MXN ejercidos en el ciclo ${year}`,
      icon: 'wallet',
      chips: [
        {
          label: String(metrics.budget.expenseCount ?? 0),
          value: 'gastos registrados',
        },
        {
          label: String(metrics.budget.budgetEnabledProjects),
          value: 'proyectos con presupuesto',
        },
      ],
      roles: ['ADMINISTRATOR', 'COORDINATOR'],
    });
  } else if (role === 'COMMITTEE') {
    kpis.push({
      id: 'reviews',
      label: 'Dictámenes emitidos',
      value: String(metrics.decisions.total),
      caption: `En el ciclo ${year}`,
      icon: 'stamp',
      chips: [
        { label: String(metrics.decisions.approved), value: 'Aprobados' },
        {
          label: String(metrics.decisions.revisionRequested),
          value: 'Con observaciones',
        },
        { label: String(metrics.decisions.rejected), value: 'Rechazados' },
      ],
      roles: ['COMMITTEE'],
    });
  }

  return kpis;
}

/* -------------------------------------------------------------------------- */
/* Distribucion por estado y embudo                                           */
/* -------------------------------------------------------------------------- */

const STATUS_BAR_CLASSES = [
  'bg-[#1e3a6e]',
  'bg-[#2f7d8a]',
  'bg-[#7c8aa5]',
  'bg-[#aab3c5]',
  'bg-[#c3a86b]',
  'bg-[#8a6f9e]',
  'bg-[#4f8a6d]',
  'bg-[#b06f6f]',
  'bg-[#6f7b8a]',
];

export interface StatusShare {
  name: string;
  projects: number;
  share: number;
  barClassName: string;
}

/** RF-008: distribucion porcentual del inventario por estado actual. */
export function statusShares(metrics: DashboardMetrics): StatusShare[] {
  const total = metrics.totalProjects;
  if (total <= 0) {
    return [];
  }
  return metrics.statusCounts
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((item, index) => ({
      name: STATUS_LABELS[item.status] ?? item.status,
      projects: item.count,
      share: Math.round((item.count / total) * 1000) / 10,
      barClassName: STATUS_BAR_CLASSES[index % STATUS_BAR_CLASSES.length] ?? 'bg-[#1e3a6e]',
    }));
}

/** Estados de proyecto que alimentan cada etapa del embudo institucional. */
export const PHASE_STATUSES: string[][] = [
  ['Draft', 'Proposed'],
  ['Under_Review'],
  ['Approved', 'Rejected'],
  ['Active', 'Suspended'],
  ['Completed', 'Closed'],
];

/** Conteos del embudo del ciclo de vida a partir de `statusCounts`. */
export function lifecycleCounts(metrics: DashboardMetrics): number[] {
  const byStatus = new Map(
    metrics.statusCounts.map((item) => [item.status, item.count]),
  );
  return PHASE_STATUSES.map((statuses) =>
    statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0),
  );
}

export function dashboardLifecycle(metrics: DashboardMetrics): LifecycleModel {
  return institutionalLifecycle(lifecycleCounts(metrics));
}

/* -------------------------------------------------------------------------- */
/* Tabla de seguimiento                                                       */
/* -------------------------------------------------------------------------- */

const SLA_VALUES: SlaStatus[] = [
  'on_track',
  'at_risk',
  'upcoming',
  'no_milestones',
];

function toSlaStatus(value: string): SlaStatus {
  return SLA_VALUES.find((status) => status === value) ?? 'on_track';
}

function projectKey(projectId: string): string {
  const numeric = Number(projectId);
  if (Number.isFinite(numeric)) {
    return `PRJ-${String(numeric).padStart(4, '0')}`;
  }
  return projectId;
}

/** Traduce un proyecto del backend al modelo de la tabla institucional. */
export function mapDashboardProject(project: DashboardProject): PriorityProject {
  return {
    id: projectKey(project.projectId),
    title: project.title,
    call: project.callTitle ?? 'Sin convocatoria',
    pi: project.piName ?? 'Sin investigador registrado',
    milestone: project.currentMilestone ?? 'Sin hitos pendientes',
    dueDate: project.currentMilestoneDueDate ?? project.endDate,
    sla: toSlaStatus(project.slaStatus),
    projectStatus: project.status,
    daysLate: project.daysLate ?? undefined,
  };
}
