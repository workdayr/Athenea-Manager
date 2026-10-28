import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import type { Prisma, ProjectStatus } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { TtlCache } from './reporting.cache.js';
import {
  DASHBOARD_CACHE_TTL_MS,
  DELAY_THRESHOLD_DAYS,
  PROJECT_STATUS_VALUES,
  REPORT_CACHE_MAX_ENTRIES,
  REPORT_ERROR_CODES,
  REPORT_PAGE_SIZE_DEFAULT,
  REPORT_PAGE_SIZE_MAX,
  REPORT_SEARCH_MAX_LENGTH,
  type ReportingProjectStatus,
} from './reporting.constants.js';
import {
  type CallOptionGql,
  type CoordinatorDashboardGql,
  type DashboardMetricsGql,
  type DashboardProjectGql,
  type ReportFiltersInput,
  type StatisticalReportGql,
  SlaStatusGql,
  type StatusCountGql,
} from './reporting.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REPORT_YEAR = 2100;
const MIN_REPORT_YEAR = 2000;

export class ReportError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

interface NormalizedFilters {
  from: Date;
  to: Date;
  statuses: ReportingProjectStatus[];
  callId: number | null;
  search: string | null;
  page: number;
  pageSize: number;
}

interface TablePageData {
  projects: DashboardProjectGql[];
  totalFilteredProjects: number;
  totalPages: number;
}

function fail(code: string, message: string, field?: string): never {
  throw new ReportError(code, message, field);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function yearRange(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

function normalizeFilters(
  filters: ReportFiltersInput | null | undefined,
): NormalizedFilters {
  const currentYear = new Date().getUTCFullYear();
  const year = filters?.year ?? currentYear;
  if (
    !Number.isInteger(year) ||
    year < MIN_REPORT_YEAR ||
    year > MAX_REPORT_YEAR
  ) {
    fail(
      REPORT_ERROR_CODES.VALIDATION_ERROR,
      `El ano debe estar entre ${MIN_REPORT_YEAR} y ${MAX_REPORT_YEAR}.`,
      'year',
    );
  }

  const defaults = yearRange(year);
  const from = filters?.from ?? defaults.from;
  const to = filters?.to ?? defaults.to;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    fail(
      REPORT_ERROR_CODES.VALIDATION_ERROR,
      'El rango de fechas no es valido.',
      'from',
    );
  }
  if (from.getTime() > to.getTime()) {
    fail(
      REPORT_ERROR_CODES.VALIDATION_ERROR,
      'La fecha inicial no puede ser posterior a la fecha final.',
      'from',
    );
  }

  const callId = filters?.callId ?? null;
  if (callId !== null && (!Number.isInteger(callId) || callId <= 0)) {
    fail(
      REPORT_ERROR_CODES.VALIDATION_ERROR,
      'La convocatoria indicada no es valida.',
      'callId',
    );
  }

  const statuses = Array.from(new Set(filters?.statuses ?? [])).filter(
    (status) =>
      PROJECT_STATUS_VALUES.includes(status as ReportingProjectStatus),
  ) as ReportingProjectStatus[];
  const search =
    filters?.search?.trim().slice(0, REPORT_SEARCH_MAX_LENGTH) || null;

  return {
    from,
    to,
    statuses,
    callId,
    search,
    page: clamp(Math.trunc(filters?.page ?? 1), 1, Number.MAX_SAFE_INTEGER),
    pageSize: clamp(
      Math.trunc(filters?.pageSize ?? REPORT_PAGE_SIZE_DEFAULT),
      1,
      REPORT_PAGE_SIZE_MAX,
    ),
  };
}

function metricWhere(filters: NormalizedFilters): Prisma.ProjectWhereInput {
  return {
    start_date: { lte: filters.to },
    end_date: { gte: filters.from },
    ...(filters.callId !== null ? { call_id: filters.callId } : {}),
  };
}

function tableWhere(filters: NormalizedFilters): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = { ...metricWhere(filters) };
  if (filters.statuses.length > 0) {
    where.status = { in: filters.statuses as ProjectStatus[] };
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      {
        projectUsers: {
          some: {
            project_role: 'Principal_Investigator',
            user: {
              name: { contains: filters.search, mode: 'insensitive' },
            },
          },
        },
      },
    ];
  }
  return where;
}

function reportWhere(filters: NormalizedFilters): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = { ...metricWhere(filters) };
  if (filters.statuses.length > 0) {
    where.status = { in: filters.statuses as ProjectStatus[] };
  }
  return where;
}

function delayedMilestoneWhere(
  where: Prisma.ProjectWhereInput,
): Prisma.MilestoneWhereInput {
  const threshold = new Date(Date.now() - DELAY_THRESHOLD_DAYS * DAY_MS);
  return {
    project: where,
    OR: [
      { status: 'Delayed' },
      { status: { not: 'Completed' }, due_date: { lt: threshold } },
    ],
  };
}

function slaFor(
  milestone: { due_date: Date; status: string } | null,
): { slaStatus: SlaStatusGql; daysLate: number | null } {
  if (!milestone) {
    return { slaStatus: SlaStatusGql.no_milestones, daysLate: null };
  }

  const now = Date.now();
  const due = milestone.due_date.getTime();
  const diffDays = Math.floor((now - due) / DAY_MS);
  if (milestone.status === 'Delayed' || diffDays >= DELAY_THRESHOLD_DAYS) {
    return {
      slaStatus: SlaStatusGql.at_risk,
      daysLate: Math.max(0, diffDays),
    };
  }
  if (due > now && due - now <= DELAY_THRESHOLD_DAYS * DAY_MS) {
    return { slaStatus: SlaStatusGql.upcoming, daysLate: null };
  }
  return { slaStatus: SlaStatusGql.on_track, daysLate: null };
}

function statusCounts(
  groups: Array<{ status: ProjectStatus; _count: { _all: number } }>,
): StatusCountGql[] {
  const counts = new Map(groups.map((group) => [group.status, group._count._all]));
  return PROJECT_STATUS_VALUES.map((status) => ({
    status: status as StatusCountGql['status'],
    count: counts.get(status as ProjectStatus) ?? 0,
  }));
}

function cacheKey(
  kind: string,
  role: string,
  filters: NormalizedFilters,
  extra = '',
): string {
  return [
    kind,
    role,
    filters.from.toISOString(),
    filters.to.toISOString(),
    filters.callId ?? 'all',
    extra,
  ].join('|');
}

function tableCacheKey(
  role: string,
  filters: NormalizedFilters,
): string {
  return cacheKey('table', role, filters, [
    filters.statuses.join(','),
    filters.search ?? '',
    filters.page,
    filters.pageSize,
  ].join('|'));
}

async function computeCallOptions(): Promise<CallOptionGql[]> {
  const rows = await prisma.announcement.findMany({
    select: { call_id: true, title: true },
    orderBy: { deadline: 'desc' },
    take: 100,
  });
  return rows.map((row) => ({ callId: row.call_id, title: row.title }));
}

async function computeMetrics(
  where: Prisma.ProjectWhereInput,
  filters: NormalizedFilters,
  includeBudget: boolean,
): Promise<DashboardMetricsGql> {
  const delayedWhere = delayedMilestoneWhere(where);
  const [
    projectStatusGroups,
    budgetAggregate,
    budgetEnabledProjects,
    milestoneStatusGroups,
    delayedMilestones,
    delayedProjectRows,
    researchProducts,
    researcherGroups,
    decisionGroups,
  ] = await Promise.all([
    prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    includeBudget
      ? prisma.expense.aggregate({
          where: {
            project: where,
            expense_date: { gte: filters.from, lte: filters.to },
          },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : Promise.resolve(null),
    prisma.project.count({ where: { ...where, budget_enabled: true } }),
    prisma.milestone.groupBy({
      by: ['status'],
      where: { project: where },
      _count: { _all: true },
    }),
    prisma.milestone.count({ where: delayedWhere }),
    prisma.milestone.findMany({
      where: delayedWhere,
      select: { project_id: true },
      distinct: ['project_id'],
    }),
    prisma.product.count({ where: { project: where } }),
    prisma.project_User.groupBy({
      by: ['user_id'],
      where: { project: where },
    }),
    prisma.proposal_Evaluation.groupBy({
      by: ['decision'],
      where: {
        project: where,
        created_at: { gte: filters.from, lte: filters.to },
      },
      _count: { _all: true },
    }),
  ]);

  const statuses = statusCounts(projectStatusGroups);
  const statusMap = new Map<string, number>(
    statuses.map((item) => [item.status, item.count]),
  );
  const totalProjects = statuses.reduce((sum, item) => sum + item.count, 0);
  const activeProjects = statusMap.get('Active') ?? 0;
  const completedProjects =
    (statusMap.get('Completed') ?? 0) + (statusMap.get('Closed') ?? 0);

  const milestoneMap = new Map<string, number>(
    milestoneStatusGroups.map((group) => [group.status, group._count._all]),
  );
  const milestonesTotal = Array.from(milestoneMap.values()).reduce(
    (sum, count) => sum + count,
    0,
  );
  const milestonesCompleted = milestoneMap.get('Completed') ?? 0;

  const decisionMap = new Map<string, number>(
    decisionGroups.map((group) => [group.decision, group._count._all]),
  );
  const approved = decisionMap.get('Approved') ?? 0;
  const rejected = decisionMap.get('Rejected') ?? 0;
  const revisionRequested = decisionMap.get('Revision_Required') ?? 0;
  const totalDecisions = approved + rejected + revisionRequested;

  const budgetSpent =
    includeBudget && budgetAggregate
      ? Number(budgetAggregate._sum.amount ?? 0)
      : null;
  const expenseCount =
    includeBudget && budgetAggregate ? budgetAggregate._count._all : null;

  return {
    totalProjects,
    statusCounts: statuses,
    activeProjects,
    completedProjects,
    delayedProjects: delayedProjectRows.length,
    budget: {
      spent: budgetSpent,
      expenseCount,
      budgetEnabledProjects,
    },
    productivity: {
      milestonesTotal,
      milestonesCompleted,
      milestonesDelayed: delayedMilestones,
      completionRate:
        milestonesTotal > 0
          ? (milestonesCompleted / milestonesTotal) * 100
          : 0,
      researchProducts,
      activeResearchers: researcherGroups.length,
      productsPerActiveProject:
        activeProjects > 0 ? researchProducts / activeProjects : 0,
    },
    decisions: {
      total: totalDecisions,
      approved,
      rejected,
      revisionRequested,
      approvalRate:
        totalDecisions > 0 ? (approved / totalDecisions) * 100 : 0,
    },
  };
}

async function computeTablePage(
  where: Prisma.ProjectWhereInput,
  page: number,
  pageSize: number,
): Promise<TablePageData> {
  const [totalFilteredProjects, rows] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [{ end_date: 'asc' }, { project_id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        project_id: true,
        title: true,
        status: true,
        start_date: true,
        end_date: true,
        call: { select: { title: true } },
        projectUsers: {
          where: { project_role: 'Principal_Investigator' },
          select: { user: { select: { name: true } } },
          take: 1,
        },
        milestones: {
          where: { status: { not: 'Completed' } },
          orderBy: { due_date: 'asc' },
          take: 1,
          select: { name: true, due_date: true, status: true },
        },
      },
    }),
  ]);

  const projects: DashboardProjectGql[] = rows.map((row) => {
    const milestone = row.milestones[0] ?? null;
    const sla = slaFor(milestone);
    return {
      projectId: row.project_id,
      title: row.title,
      status: row.status as DashboardProjectGql['status'],
      piName: row.projectUsers[0]?.user.name ?? null,
      callTitle: row.call?.title ?? null,
      startDate: row.start_date,
      endDate: row.end_date,
      currentMilestone: milestone?.name ?? null,
      currentMilestoneDueDate: milestone?.due_date ?? null,
      slaStatus: sla.slaStatus,
      daysLate: sla.daysLate,
    };
  });

  return {
    projects,
    totalFilteredProjects,
    totalPages: Math.max(1, Math.ceil(totalFilteredProjects / pageSize)),
  };
}

/**
 * RF-008 / UC-009: metricas institucionales y tabla de seguimiento.
 *
 * La cache se divide en tres entradas independientes (metricas, pagina de
 * tabla y convocatorias) para que cambiar un filtro de tabla no obligue a
 * recalcular los KPIs del periodo. Todas respetan el TTL maximo de 15 min.
 */
@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly metricsCache = new TtlCache<DashboardMetricsGql>(
    DASHBOARD_CACHE_TTL_MS,
    REPORT_CACHE_MAX_ENTRIES,
  );
  private readonly tableCache = new TtlCache<TablePageData>(
    DASHBOARD_CACHE_TTL_MS,
    REPORT_CACHE_MAX_ENTRIES,
  );
  private readonly callCache = new TtlCache<CallOptionGql[]>(
    DASHBOARD_CACHE_TTL_MS,
    REPORT_CACHE_MAX_ENTRIES,
  );

  /** Expuesto para pruebas y para invalidar en caliente si hiciera falta. */
  clearCache(): void {
    this.metricsCache.clear();
    this.tableCache.clear();
    this.callCache.clear();
  }

  async coordinatorDashboard(
    user: AuthenticatedUser,
    filtersInput?: ReportFiltersInput | null,
  ): Promise<CoordinatorDashboardGql> {
    const filters = normalizeFilters(filtersInput);
    const includeBudget = user.role !== 'COMMITTEE';
    const startedAt = Date.now();

    try {
      const where = metricWhere(filters);
      const metricsKey = cacheKey('metrics', user.role, filters);
      const [metricsResult, tableResult, callsResult] = await Promise.all([
        this.metricsCache.getOrLoad(metricsKey, () =>
          computeMetrics(where, filters, includeBudget),
        ),
        this.tableCache.getOrLoad(tableCacheKey(user.role, filters), () =>
          computeTablePage(tableWhere(filters), filters.page, filters.pageSize),
        ),
        this.callCache.getOrLoad('calls|all', computeCallOptions),
      ]);

      const fromCache =
        metricsResult.fromCache &&
        tableResult.fromCache &&
        callsResult.fromCache;
      const generatedAt = Math.min(
        metricsResult.cachedAt,
        tableResult.cachedAt,
        callsResult.cachedAt,
      );
      const cacheExpiresAt = Math.min(
        metricsResult.expiresAt,
        tableResult.expiresAt,
        callsResult.expiresAt,
      );

      return {
        metrics: metricsResult.value,
        projects: tableResult.value.projects,
        callOptions: callsResult.value,
        totalFilteredProjects: tableResult.value.totalFilteredProjects,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: tableResult.value.totalPages,
        range: { from: filters.from, to: filters.to },
        generatedAt: new Date(generatedAt),
        cacheExpiresAt: new Date(cacheExpiresAt),
        fromCache,
        computationMs: fromCache ? 0 : Date.now() - startedAt,
      };
    } catch (error) {
      this.rethrow(error);
    }
  }

  async statisticalReport(
    user: AuthenticatedUser,
    filtersInput?: ReportFiltersInput | null,
  ): Promise<StatisticalReportGql> {
    const filters = normalizeFilters(filtersInput);
    const includeBudget = user.role !== 'COMMITTEE';
    const startedAt = Date.now();

    try {
      const key = cacheKey(
        'metrics',
        user.role,
        filters,
        filters.statuses.join(','),
      );
      const result = await this.metricsCache.getOrLoad(key, () =>
        computeMetrics(reportWhere(filters), filters, includeBudget),
      );
      return {
        metrics: result.value,
        range: { from: filters.from, to: filters.to },
        generatedAt: new Date(result.cachedAt),
        cacheExpiresAt: new Date(result.expiresAt),
        fromCache: result.fromCache,
        computationMs: result.fromCache ? 0 : Date.now() - startedAt,
      };
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof ReportError) {
      throw error;
    }
    this.logger.error(
      'Fallo al calcular las metricas del dashboard.',
      error instanceof Error ? error.stack : String(error),
    );
    throw new ReportError(
      REPORT_ERROR_CODES.REPORTING_UNAVAILABLE,
      'No se pudieron calcular las metricas del tablero. Intenta de nuevo.',
    );
  }
}
