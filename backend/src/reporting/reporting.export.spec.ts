import { describe, expect, it } from 'vitest';
import {
  buildCoordinatorCsv,
  buildStatisticalCsv,
  csvEscape,
  reportFiltersLabel,
} from './reporting.export.js';
import type {
  CoordinatorDashboardGql,
  StatisticalReportGql,
} from './reporting.model.js';

function metricsFixture() {
  return {
    totalProjects: 4,
    statusCounts: [
      { status: 'Active', count: 3 },
      { status: 'Completed', count: 1 },
    ],
    activeProjects: 3,
    completedProjects: 1,
    delayedProjects: 1,
    budget: { spent: 1500.5, expenseCount: 2, budgetEnabledProjects: 1 },
    productivity: {
      milestonesTotal: 10,
      milestonesCompleted: 7,
      milestonesDelayed: 1,
      completionRate: 70,
      researchProducts: 2,
      activeResearchers: 5,
      productsPerActiveProject: 0.67,
    },
    decisions: {
      total: 3,
      approved: 2,
      rejected: 1,
      revisionRequested: 0,
      approvalRate: 66.67,
    },
  };
}

describe('csvEscape (F2-05)', () => {
  it('escapa separadores, comillas y saltos de linea', () => {
    expect(csvEscape('simple')).toBe('simple');
    expect(csvEscape('con; punto y coma')).toBe('"con; punto y coma"');
    expect(csvEscape('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvEscape('linea\nnueva')).toBe('"linea\nnueva"');
    expect(csvEscape(null)).toBe('');
  });
});

describe('buildCoordinatorCsv (F2-05)', () => {
  it('incluye KPI, filas filtradas y encabezado con BOM', () => {
    const data = {
      metrics: metricsFixture(),
      projects: [
        {
          projectId: 12,
          title: 'Proyecto; "especial"',
          status: 'Active',
          piName: 'Ana Pérez',
          callTitle: 'Convocatoria 2026',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          currentMilestone: 'Avance 1',
          currentMilestoneDueDate: new Date('2026-06-01T00:00:00.000Z'),
          slaStatus: 'on_track',
          daysLate: null,
        },
      ],
      callOptions: [],
      totalFilteredProjects: 37,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      range: {
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-12-31T00:00:00.000Z'),
      },
      generatedAt: new Date('2026-11-14T00:00:00.000Z'),
      cacheExpiresAt: new Date('2026-11-14T00:15:00.000Z'),
      fromCache: false,
      computationMs: 10,
    } as CoordinatorDashboardGql;

    const csv = buildCoordinatorCsv(data, { year: 2026, search: 'salud' });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Proyectos totales;4');
    expect(csv).toContain('Año=2026');
    expect(csv).toContain('Busqueda=salud');
    expect(csv).toContain('"Proyecto; ""especial"""');
    expect(csv).toContain('Total filtrado: 37 proyecto(s)');
  });
});

describe('buildStatisticalCsv (F2-05)', () => {
  it('incluye métricas y distribución por estado', () => {
    const data = {
      metrics: metricsFixture(),
      range: {
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-12-31T00:00:00.000Z'),
      },
      generatedAt: new Date('2026-11-14T00:00:00.000Z'),
      cacheExpiresAt: new Date('2026-11-14T00:15:00.000Z'),
      fromCache: false,
      computationMs: 5,
    } as StatisticalReportGql;

    const csv = buildStatisticalCsv(data);
    expect(csv).toContain('Reporte estadístico');
    expect(csv).toContain('Hitos retrasados;1');
    expect(csv).toContain('Active;3');
    expect(csv).toContain('Tasa de aprobación (%);66.67');
  });

  it('oculta el presupuesto cuando el rol no lo ve', () => {
    const metrics = metricsFixture();
    metrics.budget.spent = null as never;
    const data = {
      metrics,
      range: {
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-12-31T00:00:00.000Z'),
      },
      generatedAt: new Date('2026-11-14T00:00:00.000Z'),
      cacheExpiresAt: new Date('2026-11-14T00:15:00.000Z'),
      fromCache: false,
      computationMs: 5,
    } as StatisticalReportGql;

    expect(buildStatisticalCsv(data)).toContain(
      'Presupuesto ejercido;No disponible',
    );
  });
});

describe('reportFiltersLabel (F2-05)', () => {
  it('resume los filtros activos', () => {
    expect(
      reportFiltersLabel({
        year: 2026,
        statuses: ['Active', 'Completed'] as never,
        callId: 4,
        search: 'genoma',
      }),
    ).toBe(
      'Año=2026; Convocatoria=4; Estados=Active|Completed; Busqueda=genoma',
    );
    expect(reportFiltersLabel(null)).toBe('Sin filtros adicionales');
  });
});
