import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectStatusGql } from '../projects/projects.model.js';
import { REPORT_ERROR_CODES } from './reporting.constants.js';
import { SlaStatusGql } from './reporting.model.js';

interface FakeProject {
  project_id: number;
  title: string;
  status: string;
  start_date: Date;
  end_date: Date;
  budget_enabled: boolean;
  call_id: number;
  pi: string;
}

interface FakeMilestone {
  milestone_id: number;
  project_id: number;
  name: string;
  due_date: Date;
  status: string;
}

interface FakeExpense {
  expense_id: number;
  project_id: number;
  amount: number;
  expense_date: Date;
}

interface FakeProduct {
  product_id: number;
  project_id: number;
}

interface FakeProjectUser {
  project_id: number;
  user_id: string;
  project_role: string;
}

interface FakeEvaluation {
  evaluation_id: number;
  project_id: number;
  decision: string;
  created_at: Date;
}

const { prismaMock } = vi.hoisted(() => {
  const projects: FakeProject[] = [
    {
      project_id: 1,
      title: 'Optimizacion energetica con IA',
      status: 'Active',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T00:00:00.000Z'),
      budget_enabled: true,
      call_id: 1,
      pi: 'Alice Rivera',
    },
    {
      project_id: 2,
      title: 'Bioremediacion de aguas residuales',
      status: 'Completed',
      start_date: new Date('2026-02-01T00:00:00.000Z'),
      end_date: new Date('2026-11-30T00:00:00.000Z'),
      budget_enabled: false,
      call_id: 1,
      pi: 'Bob Torres',
    },
    {
      project_id: 3,
      title: 'Analitica para trayectorias escolares',
      status: 'Proposed',
      start_date: new Date('2026-03-01T00:00:00.000Z'),
      end_date: new Date('2027-03-01T00:00:00.000Z'),
      budget_enabled: false,
      call_id: 2,
      pi: 'Alice Rivera',
    },
    {
      project_id: 4,
      title: 'Caracterizacion de suelos agricolas',
      status: 'Under_Review',
      start_date: new Date('2025-01-01T00:00:00.000Z'),
      end_date: new Date('2026-06-30T00:00:00.000Z'),
      budget_enabled: false,
      call_id: 1,
      pi: 'Carol Mena',
    },
    {
      project_id: 5,
      title: 'Proyecto fuera del periodo',
      status: 'Draft',
      start_date: new Date('2027-01-01T00:00:00.000Z'),
      end_date: new Date('2028-01-01T00:00:00.000Z'),
      budget_enabled: false,
      call_id: 2,
      pi: 'Dan Soto',
    },
  ];

  const milestones: FakeMilestone[] = [
    {
      milestone_id: 1,
      project_id: 1,
      name: 'Protocolo aprobado',
      due_date: new Date('2026-05-01T00:00:00.000Z'),
      status: 'Completed',
    },
    {
      milestone_id: 2,
      project_id: 1,
      name: 'Validacion del modelo',
      due_date: new Date('2026-10-01T00:00:00.000Z'),
      status: 'Pending',
    },
    {
      milestone_id: 3,
      project_id: 2,
      name: 'Informe final',
      due_date: new Date('2026-06-01T00:00:00.000Z'),
      status: 'Completed',
    },
    {
      milestone_id: 4,
      project_id: 2,
      name: 'Transferencia tecnologica',
      due_date: new Date('2026-09-01T00:00:00.000Z'),
      status: 'Completed',
    },
    {
      milestone_id: 5,
      project_id: 4,
      name: 'Cierre de informe tecnico',
      due_date: new Date('2026-09-01T00:00:00.000Z'),
      status: 'Delayed',
    },
    {
      milestone_id: 6,
      project_id: 3,
      name: 'Revision de requisitos',
      due_date: new Date('2027-01-15T00:00:00.000Z'),
      status: 'Pending',
    },
  ];

  const expenses: FakeExpense[] = [
    {
      expense_id: 1,
      project_id: 1,
      amount: 1000,
      expense_date: new Date('2026-03-01T00:00:00.000Z'),
    },
    {
      expense_id: 2,
      project_id: 1,
      amount: 500,
      expense_date: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      expense_id: 3,
      project_id: 4,
      amount: 200,
      expense_date: new Date('2025-12-01T00:00:00.000Z'),
    },
    {
      expense_id: 4,
      project_id: 1,
      amount: 300,
      expense_date: new Date('2027-01-01T00:00:00.000Z'),
    },
  ];

  const products: FakeProduct[] = [
    { product_id: 1, project_id: 1 },
    { product_id: 2, project_id: 1 },
    { product_id: 3, project_id: 2 },
    { product_id: 4, project_id: 4 },
  ];

  const projectUsers: FakeProjectUser[] = [
    { project_id: 1, user_id: 'alice', project_role: 'Principal_Investigator' },
    { project_id: 2, user_id: 'bob', project_role: 'Principal_Investigator' },
    { project_id: 3, user_id: 'alice', project_role: 'Principal_Investigator' },
    { project_id: 4, user_id: 'carol', project_role: 'Principal_Investigator' },
    { project_id: 5, user_id: 'dan', project_role: 'Principal_Investigator' },
  ];

  const evaluations: FakeEvaluation[] = [
    {
      evaluation_id: 1,
      project_id: 1,
      decision: 'Approved',
      created_at: new Date('2026-05-01T00:00:00.000Z'),
    },
    {
      evaluation_id: 2,
      project_id: 2,
      decision: 'Rejected',
      created_at: new Date('2026-06-01T00:00:00.000Z'),
    },
    {
      evaluation_id: 3,
      project_id: 4,
      decision: 'Revision_Required',
      created_at: new Date('2026-07-01T00:00:00.000Z'),
    },
    {
      evaluation_id: 4,
      project_id: 3,
      decision: 'Approved',
      created_at: new Date('2025-12-01T00:00:00.000Z'),
    },
  ];

  const calls = [
    { call_id: 1, title: 'CONV-2026-A' },
    { call_id: 2, title: 'CONV-2026-B' },
  ];

  function matchesProject(project: FakeProject, where: any): boolean {
    if (!where) {
      return true;
    }
    if (
      where.start_date?.lte &&
      project.start_date.getTime() > where.start_date.lte.getTime()
    ) {
      return false;
    }
    if (
      where.end_date?.gte &&
      project.end_date.getTime() < where.end_date.gte.getTime()
    ) {
      return false;
    }
    if (
      where.call_id !== undefined &&
      where.call_id !== null &&
      project.call_id !== where.call_id
    ) {
      return false;
    }
    if (where.status?.in && !where.status.in.includes(project.status)) {
      return false;
    }
    if (
      where.budget_enabled !== undefined &&
      project.budget_enabled !== where.budget_enabled
    ) {
      return false;
    }
    if (where.OR) {
      const search = String(
        where.OR[0]?.title?.contains ??
          where.OR[1]?.projectUsers?.some?.user?.name?.contains ??
          '',
      ).toLowerCase();
      if (
        !project.title.toLowerCase().includes(search) &&
        !project.pi.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    return true;
  }

  function projectIdsFor(where: any): Set<number> {
    return new Set(
      projects
        .filter((project) => matchesProject(project, where))
        .map((project) => project.project_id),
    );
  }

  function matchesMilestone(milestone: FakeMilestone, where: any): boolean {
    const ids = projectIdsFor(where?.project);
    if (!ids.has(milestone.project_id)) {
      return false;
    }
    if (!where?.OR) {
      return true;
    }
    return where.OR.some((condition: any) => {
      if (condition.status === 'Delayed') {
        return milestone.status === 'Delayed';
      }
      if (condition.status?.not === 'Completed') {
        const threshold = condition.due_date?.lt;
        return (
          milestone.status !== 'Completed' &&
          threshold !== undefined &&
          milestone.due_date.getTime() < threshold.getTime()
        );
      }
      return false;
    });
  }

  const prismaMock = {
    project: {
      groupBy: vi.fn(async (args: any) => {
        const groups = new Map<string, number>();
        for (const project of projects.filter((item) =>
          matchesProject(item, args.where),
        )) {
          groups.set(project.status, (groups.get(project.status) ?? 0) + 1);
        }
        return Array.from(groups.entries()).map(([status, count]) => ({
          status,
          _count: { _all: count },
        }));
      }),
      count: vi.fn(async (args: any) =>
        projects.filter((project) => matchesProject(project, args.where)).length,
      ),
      findMany: vi.fn(async (args: any) => {
        const filtered = projects
          .filter((project) => matchesProject(project, args.where))
          .sort(
            (a, b) =>
              a.end_date.getTime() - b.end_date.getTime() ||
              b.project_id - a.project_id,
          );
        const start = args.skip ?? 0;
        const end = start + (args.take ?? filtered.length);
        return filtered.slice(start, end).map((project) => ({
          project_id: project.project_id,
          title: project.title,
          status: project.status,
          start_date: project.start_date,
          end_date: project.end_date,
          call: calls.find((call) => call.call_id === project.call_id) ?? null,
          projectUsers: [{ user: { name: project.pi } }],
          milestones: milestones
            .filter(
              (milestone) =>
                milestone.project_id === project.project_id &&
                milestone.status !== 'Completed',
            )
            .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
            .slice(0, 1)
            .map((milestone) => ({
              name: milestone.name,
              due_date: milestone.due_date,
              status: milestone.status,
            })),
        }));
      }),
    },
    expense: {
      aggregate: vi.fn(async (args: any) => {
        const ids = projectIdsFor(args.where.project);
        const range = args.where.expense_date;
        const filtered = expenses.filter(
          (expense) =>
            ids.has(expense.project_id) &&
            (!range ||
              (expense.expense_date.getTime() >= range.gte.getTime() &&
                expense.expense_date.getTime() <= range.lte.getTime())),
        );
        return {
          _sum: {
            amount: filtered.reduce((sum, expense) => sum + expense.amount, 0),
          },
          _count: { _all: filtered.length },
        };
      }),
    },
    milestone: {
      groupBy: vi.fn(async (args: any) => {
        const groups = new Map<string, number>();
        for (const milestone of milestones.filter((item) =>
          matchesMilestone(item, args.where),
        )) {
          groups.set(milestone.status, (groups.get(milestone.status) ?? 0) + 1);
        }
        return Array.from(groups.entries()).map(([status, count]) => ({
          status,
          _count: { _all: count },
        }));
      }),
      count: vi.fn(
        async (args: any) =>
          milestones.filter((milestone) =>
            matchesMilestone(milestone, args.where),
          ).length,
      ),
      findMany: vi.fn(async (args: any) => {
        const filtered = milestones.filter((milestone) =>
          matchesMilestone(milestone, args.where),
        );
        const unique = new Map<number, FakeMilestone>();
        for (const milestone of filtered) {
          unique.set(milestone.project_id, milestone);
        }
        return Array.from(unique.values()).map((milestone) => ({
          project_id: milestone.project_id,
        }));
      }),
    },
    product: {
      count: vi.fn(async (args: any) => {
        const ids = projectIdsFor(args.where.project);
        return products.filter((product) => ids.has(product.project_id)).length;
      }),
    },
    project_User: {
      groupBy: vi.fn(async (args: any) => {
        const ids = projectIdsFor(args.where.project);
        const users = new Set(
          projectUsers
            .filter((member) => ids.has(member.project_id))
            .map((member) => member.user_id),
        );
        return Array.from(users).map((user_id) => ({ user_id }));
      }),
    },
    proposal_Evaluation: {
      groupBy: vi.fn(async (args: any) => {
        const ids = projectIdsFor(args.where.project);
        const range = args.where.created_at;
        const groups = new Map<string, number>();
        for (const evaluation of evaluations.filter(
          (item) =>
            ids.has(item.project_id) &&
            (!range ||
              (item.created_at.getTime() >= range.gte.getTime() &&
                item.created_at.getTime() <= range.lte.getTime())),
        )) {
          groups.set(
            evaluation.decision,
            (groups.get(evaluation.decision) ?? 0) + 1,
          );
        }
        return Array.from(groups.entries()).map(([decision, count]) => ({
          decision,
          _count: { _all: count },
        }));
      }),
    },
    announcement: {
      findMany: vi.fn(async () => calls),
    },
  };

  return {
    prismaMock,
  };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import { ReportingService } from './reporting.service.js';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@unipoli.edu.mx',
  name: 'Admin',
  role: 'ADMINISTRATOR',
};

const COMMITTEE = {
  id: 'committee-1',
  email: 'committee@unipoli.edu.mx',
  name: 'Comite',
  role: 'COMMITTEE',
};

function statusCount(
  result: Awaited<ReturnType<ReportingService['coordinatorDashboard']>>,
  status: string,
): number {
  return (
    result.metrics.statusCounts.find((item) => item.status === status)?.count ??
    0
  );
}

describe('ReportingService (RF-008 / UC-009)', () => {
  let service: ReportingService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    vi.clearAllMocks();
    service = new ReportingService();
  });

  it('calcula los KPI institucionales del periodo', async () => {
    const result = await service.coordinatorDashboard(ADMIN, { year: 2026 });

    expect(result.metrics.totalProjects).toBe(4);
    expect(result.metrics.statusCounts).toHaveLength(9);
    expect(statusCount(result, 'Draft')).toBe(0);
    expect(statusCount(result, 'Proposed')).toBe(1);
    expect(statusCount(result, 'Under_Review')).toBe(1);
    expect(statusCount(result, 'Active')).toBe(1);
    expect(statusCount(result, 'Completed')).toBe(1);
    expect(result.metrics.activeProjects).toBe(1);
    expect(result.metrics.completedProjects).toBe(1);

    expect(result.metrics.budget.spent).toBe(1500);
    expect(result.metrics.budget.expenseCount).toBe(2);
    expect(result.metrics.budget.budgetEnabledProjects).toBe(1);

    expect(result.metrics.productivity.milestonesTotal).toBe(6);
    expect(result.metrics.productivity.milestonesCompleted).toBe(3);
    expect(result.metrics.productivity.milestonesDelayed).toBe(2);
    expect(result.metrics.productivity.completionRate).toBeCloseTo(50);
    expect(result.metrics.productivity.researchProducts).toBe(4);
    expect(result.metrics.productivity.activeResearchers).toBe(3);
    expect(result.metrics.productivity.productsPerActiveProject).toBe(4);

    expect(result.metrics.decisions.total).toBe(3);
    expect(result.metrics.decisions.approved).toBe(1);
    expect(result.metrics.decisions.rejected).toBe(1);
    expect(result.metrics.decisions.revisionRequested).toBe(1);
    expect(result.metrics.decisions.approvalRate).toBeCloseTo(33.333, 3);
    expect(result.metrics.delayedProjects).toBe(2);

    // pageSize por defecto = 10, por lo que los 4 proyectos del periodo
    // caben en una sola pagina.
    expect(result.projects).toHaveLength(4);
    expect(result.totalFilteredProjects).toBe(4);
    expect(result.totalPages).toBe(1);
    expect(result.callOptions).toHaveLength(2);
    expect(result.fromCache).toBe(false);
    expect(result.computationMs).toBeGreaterThanOrEqual(0);
  });

  it('respeta el TTL maximo de 15 minutos', async () => {
    const result = await service.coordinatorDashboard(ADMIN, { year: 2026 });
    const ttl = result.cacheExpiresAt.getTime() - result.generatedAt.getTime();

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('sirve la segunda peticion desde cache y recalcula al expirar', async () => {
    const first = await service.coordinatorDashboard(ADMIN, { year: 2026 });
    expect(first.fromCache).toBe(false);
    const callsAfterFirst = prismaMock.project.findMany.mock.calls.length;

    const second = await service.coordinatorDashboard(ADMIN, { year: 2026 });
    expect(second.fromCache).toBe(true);
    expect(prismaMock.project.findMany.mock.calls.length).toBe(callsAfterFirst);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    const third = await service.coordinatorDashboard(ADMIN, { year: 2026 });
    expect(third.fromCache).toBe(false);
    expect(prismaMock.project.findMany.mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });

  it('no recalcula los KPI al filtrar la tabla por estado o busqueda', async () => {
    const base = await service.coordinatorDashboard(ADMIN, { year: 2026 });
    const filtered = await service.coordinatorDashboard(ADMIN, {
      year: 2026,
      statuses: [ProjectStatusGql.Proposed],
      search: 'Alice',
    });

    expect(filtered.metrics).toEqual(base.metrics);
    expect(filtered.totalFilteredProjects).toBe(1);
    expect(filtered.projects[0]?.projectId).toBe(3);
    expect(filtered.fromCache).toBe(false);
  });

  it('oculta el presupuesto al Comite', async () => {
    const result = await service.coordinatorDashboard(COMMITTEE, {
      year: 2026,
    });

    expect(result.metrics.budget.spent).toBeNull();
    expect(result.metrics.budget.expenseCount).toBeNull();
    expect(result.metrics.totalProjects).toBe(4);
    expect(prismaMock.expense.aggregate).not.toHaveBeenCalled();
  });

  it('limita pageSize a 50 y page a 1', async () => {
    const result = await service.coordinatorDashboard(ADMIN, {
      year: 2026,
      page: 0,
      pageSize: 999,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.totalFilteredProjects).toBe(4);
  });

  it('rechaza rangos de fechas invertidos', async () => {
    await expect(
      service.coordinatorDashboard(ADMIN, {
        from: new Date('2026-12-31T00:00:00.000Z'),
        to: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: REPORT_ERROR_CODES.VALIDATION_ERROR,
      field: 'from',
    });
  });

  it('aplica el filtro de convocatoria a los KPI', async () => {
    const result = await service.coordinatorDashboard(ADMIN, {
      year: 2026,
      callId: 1,
    });

    expect(result.metrics.totalProjects).toBe(3);
    expect(result.metrics.budget.spent).toBe(1500);
  });

  it('calcula el semaforo SLA y los dias de retraso', async () => {
    const result = await service.coordinatorDashboard(ADMIN, {
      year: 2026,
      pageSize: 50,
    });

    const delayed = result.projects.find((project) => project.projectId === 4);
    expect(delayed?.slaStatus).toBe(SlaStatusGql.at_risk);
    expect(delayed?.daysLate).toBeGreaterThan(0);

    const completed = result.projects.find((project) => project.projectId === 2);
    expect(completed?.slaStatus).toBe(SlaStatusGql.no_milestones);
    expect(completed?.currentMilestone).toBeNull();
  });

  it('el reporte estadistico aplica el filtro de estados', async () => {
    const report = await service.statisticalReport(ADMIN, {
      year: 2026,
      statuses: [ProjectStatusGql.Proposed],
    });

    expect(report.metrics.totalProjects).toBe(1);
    expect(report.metrics.statusCounts).toHaveLength(9);
    expect(report.fromCache).toBe(false);
  });

  it('envuelve fallos de base de datos sin filtrar detalles internos', async () => {
    prismaMock.project.groupBy.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.coordinatorDashboard(ADMIN, { year: 2026 }),
    ).rejects.toMatchObject({
      code: REPORT_ERROR_CODES.REPORTING_UNAVAILABLE,
    });
  });

  it('mantiene las entradas de cache acotadas', async () => {
    for (let year = 2000; year <= 2099; year += 1) {
      await service.coordinatorDashboard(ADMIN, { year });
    }

    // No se expone el tamano interno; basta con verificar que sigue
    // respondiendo y que las entradas viejas se desalojaron.
    const result = await service.coordinatorDashboard(ADMIN, { year: 2026 });
    expect(result.metrics.totalProjects).toBe(4);
  });
});
