import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GraphQLError } from 'graphql';
import PDFDocument from 'pdfkit';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  DECISION_REPORT_BATCH_SIZE,
  DECISION_REPORT_DIR_NAME,
  DECISION_REPORT_ERROR_CODES,
  DECISION_REPORT_LABELS,
  resolveDecisionReportMaxAttempts,
} from './decision-report.constants.js';
import {
  canViewDecisionReport,
  decisionReportFileName,
} from './decision-report.policy.js';
import { STATUS_AFTER_DECISION } from './proposal-evaluation.constants.js';

/**
 * F1-10 / RF-019: dictamen en PDF generado de forma asincrona.
 *
 * La decision se persiste de inmediato junto a una fila `Decision_Report`
 * en `Pending`; el worker in-process produce el PDF y actualiza el estado.
 * Un fallo de generacion nunca revierte la decision (RF-019).
 */

export interface DecisionReportRow {
  report_id: number;
  evaluation_id: number;
  status: string;
  file_path: string | null;
  error: string | null;
  attempts: number;
  created_at: Date;
  ready_at: Date | null;
}

export interface DecisionReportSummary {
  scanned: number;
  ready: number;
  failed: number;
}

interface EvaluationForReport {
  evaluation_id: number;
  project_id: number;
  decision: string;
  justification: string;
  created_at: Date;
  reviewer: { name: string };
  project: {
    title: string;
    projectUsers: { user_id: string }[];
  };
}

function fail(code: string, message: string, field?: string): never {
  throw new GraphQLError(message, { extensions: { code, field } });
}

export function decisionReportDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const uploadDir = resolve(env['UPLOAD_DIR'] ?? join(process.cwd(), 'uploads'));
  return join(uploadDir, DECISION_REPORT_DIR_NAME);
}

export function decisionReportPath(reportId: number): string {
  return join(decisionReportDir(), `report-${reportId}.pdf`);
}

/** Crea el registro `Pending` dentro de la misma transaccion de la decision. */
export async function createPendingDecisionReport(
  tx: Prisma.TransactionClient,
  evaluationId: number,
): Promise<number> {
  const report = await tx.decision_Report.create({
    data: { evaluation_id: evaluationId },
  });
  return report.report_id;
}

async function loadEvaluationForReport(
  evaluationId: number,
): Promise<EvaluationForReport | null> {
  return (await prisma.proposal_Evaluation.findUnique({
    where: { evaluation_id: evaluationId },
    include: {
      reviewer: { select: { name: true } },
      project: {
        select: {
          title: true,
          projectUsers: { select: { user_id: true } },
        },
      },
    },
  })) as unknown as EvaluationForReport | null;
}

function requireReportAccess(
  viewer: AuthenticatedUser,
  evaluation: EvaluationForReport,
): void {
  const teamMemberIds = evaluation.project.projectUsers.map(
    (member) => member.user_id,
  );
  if (!canViewDecisionReport(viewer, teamMemberIds)) {
    fail(
      DECISION_REPORT_ERROR_CODES.FORBIDDEN,
      'No tienes permiso para consultar este dictamen.',
    );
  }
}

/**
 * RF-019: estado del dictamen para la pantalla de evaluacion. Si la
 * decision es anterior a esta funcionalidad, se crea el registro pendiente
 * para que el worker la genere.
 */
export async function decisionReportStatus(
  viewer: AuthenticatedUser,
  evaluationId: number,
): Promise<DecisionReportRow> {
  const evaluation = await loadEvaluationForReport(evaluationId);
  if (!evaluation) {
    fail(DECISION_REPORT_ERROR_CODES.NOT_FOUND, 'La evaluacion no existe.');
  }
  requireReportAccess(viewer, evaluation);

  let report = (await prisma.decision_Report.findUnique({
    where: { evaluation_id: evaluationId },
  })) as unknown as DecisionReportRow | null;

  if (!report) {
    report = (await prisma.decision_Report.create({
      data: { evaluation_id: evaluationId },
    })) as unknown as DecisionReportRow;
  }
  return report;
}

/** Descarga autorizada: solo cuando el PDF ya esta listo en disco. */
export async function getDecisionReportForDownload(
  viewer: AuthenticatedUser,
  evaluationId: number,
): Promise<{ path: string; fileName: string }> {
  const evaluation = await loadEvaluationForReport(evaluationId);
  if (!evaluation) {
    fail(DECISION_REPORT_ERROR_CODES.NOT_FOUND, 'La evaluacion no existe.');
  }
  requireReportAccess(viewer, evaluation);

  const report = (await prisma.decision_Report.findUnique({
    where: { evaluation_id: evaluationId },
  })) as unknown as DecisionReportRow | null;

  if (!report || report.status !== 'Ready' || !report.file_path) {
    fail(
      DECISION_REPORT_ERROR_CODES.NOT_READY,
      'El dictamen se esta generando. Intenta de nuevo en unos segundos.',
    );
  }
  try {
    await access(report.file_path);
  } catch {
    fail(
      DECISION_REPORT_ERROR_CODES.NOT_READY,
      'El archivo del dictamen no esta disponible. Se regenerara en breve.',
    );
  }

  return {
    path: report.file_path,
    fileName: decisionReportFileName(report.report_id, evaluation.project_id),
  };
}

/**
 * Genera el PDF de un dictamen concreto. Idempotente respecto al estado:
 * solo procesa `Pending` o `Failed` que aun tengan reintentos.
 */
export async function generateDecisionReport(
  reportId: number,
): Promise<'ready' | 'failed' | 'skipped'> {
  const maxAttempts = resolveDecisionReportMaxAttempts();
  const report = (await prisma.decision_Report.findUnique({
    where: { report_id: reportId },
  })) as unknown as DecisionReportRow | null;

  if (!report) {
    return 'skipped';
  }
  if (report.status === 'Ready') {
    return 'skipped';
  }
  if (report.attempts >= maxAttempts) {
    return 'skipped';
  }

  const claimed = await prisma.decision_Report.updateMany({
    where: {
      report_id: reportId,
      status: { in: ['Pending', 'Failed'] },
      attempts: { lt: maxAttempts },
    },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    return 'skipped';
  }

  try {
    const evaluation = await loadEvaluationForReport(report.evaluation_id);
    if (!evaluation) {
      throw new Error('La evaluacion asociada ya no existe.');
    }
    const pdf = await renderDecisionReportPdf({
      reportId,
      projectId: evaluation.project_id,
      projectTitle: evaluation.project.title,
      decision: evaluation.decision,
      justification: evaluation.justification,
      reviewerName: evaluation.reviewer.name,
      createdAt: evaluation.created_at,
    });

    await mkdir(decisionReportDir(), { recursive: true });
    const filePath = decisionReportPath(reportId);
    await writeFile(filePath, pdf);

    await prisma.decision_Report.update({
      where: { report_id: reportId },
      data: {
        status: 'Ready',
        file_path: filePath,
        ready_at: new Date(),
        error: null,
      },
    });
    return 'ready';
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    // El worker reintenta mientras `attempts < maxAttempts`; al agotarlos,
    // `Failed` queda como estado final y la UI muestra el error.
    await prisma.decision_Report.update({
      where: { report_id: reportId },
      data: {
        status: 'Failed',
        error: message.slice(0, 2000),
      },
    });
    return 'failed';
  }
}

/** Procesa un lote de dictamenes pendientes; expuesto para pruebas. */
export async function processPendingDecisionReports(): Promise<DecisionReportSummary> {
  const maxAttempts = resolveDecisionReportMaxAttempts();
  const rows = (await prisma.decision_Report.findMany({
    where: {
      status: { in: ['Pending', 'Failed'] },
      attempts: { lt: maxAttempts },
    },
    orderBy: { created_at: 'asc' },
    take: DECISION_REPORT_BATCH_SIZE,
    select: { report_id: true },
  })) as unknown as { report_id: number }[];

  const summary: DecisionReportSummary = {
    scanned: rows.length,
    ready: 0,
    failed: 0,
  };
  for (const row of rows) {
    const result = await generateDecisionReport(row.report_id);
    if (result === 'ready') {
      summary.ready += 1;
    } else if (result === 'failed') {
      summary.failed += 1;
    }
  }
  return summary;
}

const PAGE_MARGIN = 56;

function formatLongDate(value: Date): string {
  return value.toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export interface DecisionReportPdfInput {
  reportId: number;
  projectId: number;
  projectTitle: string;
  decision: string;
  justification: string;
  reviewerName: string;
  createdAt: Date;
}

/** Construye el PDF del dictamen en memoria (sin bloquear la decision). */
export function renderDecisionReportPdf(
  input: DecisionReportPdfInput,
): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: PAGE_MARGIN,
      info: {
        Title: `Dictamen del proyecto ${input.projectId}`,
        Author: 'Athenea Manager',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
    doc.on('error', reject);

    const label =
      DECISION_REPORT_LABELS[input.decision] ?? input.decision;
    const newStatus = STATUS_AFTER_DECISION[
      input.decision as keyof typeof STATUS_AFTER_DECISION
    ];

    doc
      .fontSize(10)
      .fillColor('#555555')
      .text('ATHENEA MANAGER · GESTIÓN DE INVESTIGACIÓN CIENTÍFICA', {
        characterSpacing: 0.5,
      });
    doc.moveDown(0.4);
    doc
      .fontSize(20)
      .fillColor('#111111')
      .text('Dictamen de evaluación');
    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`Folio: ${input.reportId} · Proyecto #${input.projectId}`);
    doc.moveDown(1);

    doc
      .fontSize(13)
      .fillColor('#111111')
      .text(input.projectTitle, { width: 480 });
    doc.moveDown(0.8);

    doc
      .fontSize(11)
      .fillColor('#111111')
      .text(`Decisión: ${label}`, { continued: false });
    if (newStatus) {
      doc.text(`Estado resultante del proyecto: ${newStatus}`);
    }
    doc.text(`Evaluador: ${input.reviewerName}`);
    doc.text(`Emitido: ${formatLongDate(input.createdAt)}`);
    doc.moveDown(1);

    doc
      .fontSize(12)
      .fillColor('#111111')
      .text('Justificación del comité');
    doc.moveDown(0.3);
    doc
      .fontSize(10.5)
      .fillColor('#333333')
      .text(input.justification, {
        width: 480,
        align: 'justify',
        lineGap: 2,
      });

    doc.moveDown(1.5);
    doc
      .fontSize(9)
      .fillColor('#777777')
      .text(
        'Documento generado automáticamente por Athenea Manager. ' +
          'Conserva este folio para cualquier aclaración institucional.',
        { width: 480 },
      );

    doc.end();
  });
}

/** Lee el PDF listo para el streaming REST. */
export function readDecisionReportFile(path: string): Promise<Buffer> {
  return readFile(path);
}
