import type {
  CoordinatorDashboardGql,
  ReportFiltersInput,
  StatisticalReportGql,
} from './reporting.model.js';

/**
 * F2-05 / RF-008: exportacion de reportes.
 *
 * Los CSV usan `;` y BOM UTF-8 para abrirse directamente en Excel en
 * espanol, igual que la exportacion previa del cliente. Los datos ya
 * vienen filtrados y autorizados por `ReportingService`.
 */

export function csvEscape(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(';');
}

function toCsv(lines: unknown[][]): string {
  return `\uFEFF${lines.map(csvRow).join('\r\n')}\r\n`;
}

function isoDate(value: Date | null | undefined): string {
  return value ? new Date(value).toISOString() : '';
}

export function reportFiltersLabel(
  filters: ReportFiltersInput | null | undefined,
): string {
  const parts: string[] = [];
  if (filters?.year) parts.push(`Año=${filters.year}`);
  if (filters?.from) parts.push(`Desde=${isoDate(filters.from)}`);
  if (filters?.to) parts.push(`Hasta=${isoDate(filters.to)}`);
  if (filters?.callId) parts.push(`Convocatoria=${filters.callId}`);
  if (filters?.statuses?.length) {
    parts.push(`Estados=${filters.statuses.join('|')}`);
  }
  if (filters?.search) parts.push(`Busqueda=${filters.search}`);
  return parts.join('; ') || 'Sin filtros adicionales';
}

export function buildCoordinatorCsv(
  data: CoordinatorDashboardGql,
  filters?: ReportFiltersInput | null,
): string {
  const metrics = data.metrics;
  const lines: unknown[][] = [
    ['Reporte ejecutivo institucional — Athenea Manager'],
    ['Generado', isoDate(data.generatedAt)],
    ['Periodo', `${isoDate(data.range.from)} a ${isoDate(data.range.to)}`],
    ['Filtros', reportFiltersLabel(filters)],
    [],
    ['Indicador', 'Valor'],
    ['Proyectos totales', metrics.totalProjects],
    ['Proyectos activos', metrics.activeProjects],
    ['Proyectos concluidos', metrics.completedProjects],
    ['Proyectos con retraso', metrics.delayedProjects],
    [
      'Presupuesto ejercido',
      metrics.budget.spent === null ? 'No disponible' : metrics.budget.spent,
    ],
    [
      'Hitos completados',
      `${metrics.productivity.milestonesCompleted} de ${metrics.productivity.milestonesTotal}`,
    ],
    ['Tasa de cumplimiento (%)', metrics.productivity.completionRate],
    ['Productos de investigación', metrics.productivity.researchProducts],
    ['Investigadores activos', metrics.productivity.activeResearchers],
    [
      'Dictámenes emitidos',
      `${metrics.decisions.total} (aprobados ${metrics.decisions.approved}, ` +
        `rechazados ${metrics.decisions.rejected}, ` +
        `revisión ${metrics.decisions.revisionRequested})`,
    ],
    [],
    [
      'Clave',
      'Título',
      'Investigador',
      'Convocatoria',
      'Hito actual',
      'Vencimiento',
      'Semáforo',
      'Estado',
      'Días de retraso',
      'Inicio',
      'Fin',
    ],
  ];

  for (const project of data.projects) {
    lines.push([
      project.projectId,
      project.title,
      project.piName ?? '',
      project.callTitle ?? '',
      project.currentMilestone ?? '',
      isoDate(project.currentMilestoneDueDate),
      project.slaStatus,
      project.status,
      project.daysLate ?? '',
      isoDate(project.startDate),
      isoDate(project.endDate),
    ]);
  }

  lines.push([], [`Total filtrado: ${data.totalFilteredProjects} proyecto(s)`]);
  return toCsv(lines);
}

export function buildStatisticalCsv(
  data: StatisticalReportGql,
  filters?: ReportFiltersInput | null,
): string {
  const metrics = data.metrics;
  const lines: unknown[][] = [
    ['Reporte estadístico — Athenea Manager'],
    ['Generado', isoDate(data.generatedAt)],
    ['Periodo', `${isoDate(data.range.from)} a ${isoDate(data.range.to)}`],
    ['Filtros', reportFiltersLabel(filters)],
    [],
    ['Métrica', 'Valor'],
    ['Proyectos totales', metrics.totalProjects],
    ['Proyectos activos', metrics.activeProjects],
    ['Proyectos concluidos', metrics.completedProjects],
    ['Proyectos con retraso', metrics.delayedProjects],
    [
      'Presupuesto ejercido',
      metrics.budget.spent === null ? 'No disponible' : metrics.budget.spent,
    ],
    ['Proyectos con presupuesto', metrics.budget.budgetEnabledProjects],
    ['Hitos totales', metrics.productivity.milestonesTotal],
    ['Hitos completados', metrics.productivity.milestonesCompleted],
    ['Hitos retrasados', metrics.productivity.milestonesDelayed],
    ['Tasa de cumplimiento (%)', metrics.productivity.completionRate],
    ['Productos de investigación', metrics.productivity.researchProducts],
    ['Investigadores activos', metrics.productivity.activeResearchers],
    ['Dictámenes emitidos', metrics.decisions.total],
    ['Dictámenes aprobados', metrics.decisions.approved],
    ['Dictámenes rechazados', metrics.decisions.rejected],
    ['Revisión requerida', metrics.decisions.revisionRequested],
    ['Tasa de aprobación (%)', metrics.decisions.approvalRate],
    [],
    ['Estado', 'Proyectos'],
  ];
  for (const entry of metrics.statusCounts) {
    lines.push([entry.status, entry.count]);
  }
  return toCsv(lines);
}
