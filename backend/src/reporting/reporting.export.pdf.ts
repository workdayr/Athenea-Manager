import PDFDocument from 'pdfkit';
import type {
  CoordinatorDashboardGql,
  StatisticalReportGql,
} from './reporting.model.js';

/**
 * F2-05 / RF-008: version PDF de los reportes (informe ejecutivo).
 * Mismo universo filtrado que la version CSV; el presupuesto del Comité ya
 * llega en null desde `ReportingService` y aqui se muestra como "No disponible".
 */

const MARGIN = 50;

function render(
  build: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: MARGIN,
      info: { Author: 'Athenea Manager' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc
    .fontSize(9)
    .fillColor('#666666')
    .text('ATHENEA MANAGER · GESTIÓN DE INVESTIGACIÓN CIENTÍFICA');
  doc.moveDown(0.3);
  doc.fontSize(19).fillColor('#111111').text(title);
  doc.fontSize(9.5).fillColor('#555555').text(subtitle);
  doc.moveDown(0.8);
}

function kpi(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(10).fillColor('#111111').text(`${label}: `, {
    continued: true,
  });
  doc.fillColor('#333333').text(value);
}

function rangeLabel(data: {
  range: { from: Date; to: Date };
  generatedAt: Date;
}): string {
  const from = new Date(data.range.from).toLocaleDateString('es-MX');
  const to = new Date(data.range.to).toLocaleDateString('es-MX');
  const generated = new Date(data.generatedAt).toLocaleString('es-MX');
  return `Periodo ${from} — ${to} · Generado ${generated}`;
}

export function renderCoordinatorReportPdf(
  data: CoordinatorDashboardGql,
  filtersLabel: string,
): Promise<Buffer> {
  return render((doc) => {
    header(doc, 'Informe ejecutivo institucional', rangeLabel(data));
    if (filtersLabel) {
      doc.fontSize(8.5).fillColor('#666666').text(filtersLabel);
      doc.moveDown(0.6);
    }

    doc.fontSize(12).fillColor('#111111').text('Indicadores');
    doc.moveDown(0.3);
    const m = data.metrics;
    kpi(doc, 'Proyectos totales', String(m.totalProjects));
    kpi(doc, 'Activos', String(m.activeProjects));
    kpi(doc, 'Concluidos', String(m.completedProjects));
    kpi(doc, 'Con retraso', String(m.delayedProjects));
    kpi(
      doc,
      'Presupuesto ejercido',
      m.budget.spent === null
        ? 'No disponible'
        : new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(m.budget.spent),
    );
    kpi(
      doc,
      'Cumplimiento de hitos',
      `${m.productivity.completionRate}% (${m.productivity.milestonesCompleted}/${m.productivity.milestonesTotal})`,
    );
    kpi(doc, 'Investigadores activos', String(m.productivity.activeResearchers));
    kpi(
      doc,
      'Dictámenes',
      `${m.decisions.total} emitidos · ${m.decisions.approved} aprobados · ${m.decisions.rejected} rechazados`,
    );
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#111111').text('Inventario de proyectos');
    doc.moveDown(0.4);

    for (const project of data.projects) {
      doc
        .fontSize(10)
        .fillColor('#111111')
        .text(`${project.projectId} · ${project.title}`, { width: 512 });
      doc
        .fontSize(8.5)
        .fillColor('#555555')
        .text(
          `PI: ${project.piName ?? '—'} · Estado: ${project.status} · ` +
            `Hito: ${project.currentMilestone ?? '—'} · ` +
            `Semáforo: ${project.slaStatus}`,
        );
      doc.moveDown(0.5);
      if (doc.y > 700) {
        doc.addPage();
      }
    }

    doc.moveDown(0.8);
    doc
      .fontSize(8.5)
      .fillColor('#777777')
      .text(`Total filtrado: ${data.totalFilteredProjects} proyecto(s).`);
  });
}

export function renderStatisticalReportPdf(
  data: StatisticalReportGql,
  filtersLabel: string,
): Promise<Buffer> {
  return render((doc) => {
    header(doc, 'Reporte estadístico', rangeLabel(data));
    if (filtersLabel) {
      doc.fontSize(8.5).fillColor('#666666').text(filtersLabel);
      doc.moveDown(0.6);
    }

    const m = data.metrics;
    doc.fontSize(12).fillColor('#111111').text('Indicadores del periodo');
    doc.moveDown(0.3);
    kpi(doc, 'Proyectos totales', String(m.totalProjects));
    kpi(doc, 'Activos', String(m.activeProjects));
    kpi(doc, 'Concluidos', String(m.completedProjects));
    kpi(doc, 'Con retraso', String(m.delayedProjects));
    kpi(
      doc,
      'Presupuesto ejercido',
      m.budget.spent === null
        ? 'No disponible'
        : new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(m.budget.spent),
    );
    kpi(doc, 'Hitos retrasados', String(m.productivity.milestonesDelayed));
    kpi(doc, 'Productos registrados', String(m.productivity.researchProducts));
    kpi(
      doc,
      'Tasa de aprobación',
      `${m.decisions.approvalRate}% (${m.decisions.approved}/${m.decisions.total})`,
    );
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#111111').text('Distribución por estado');
    doc.moveDown(0.3);
    for (const entry of m.statusCounts) {
      kpi(doc, entry.status, String(entry.count));
    }
  });
}
