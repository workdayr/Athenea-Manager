import 'dotenv/config';
import { readFile, unlink } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  decisionReportStatus,
  generateDecisionReport,
  getDecisionReportForDownload,
} from './decision-report.service.js';
import {
  proposalContext,
  submitProjectDecision,
} from './proposal-evaluation.service.js';

/**
 * Integración real contra PostgreSQL de F1-10 / RF-019 y BR-004:
 * la decision se guarda de inmediato con su `Decision_Report` pendiente,
 * el worker genera el PDF, el equipo puede descargarlo y el conflicto
 * departamental bloquea la evaluacion.
 *
 * Datos únicos por ejecución con limpieza en `afterAll`; se omiten si no
 * hay base de datos disponible.
 */

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdEmails: string[] = [];
const createdProjectIds: number[] = [];
const createdEvaluationIds: number[] = [];
const generatedFiles: string[] = [];

async function createUser(input: {
  id: string;
  role: 'PRINCIPAL_INVESTIGATOR' | 'COMMITTEE' | 'STUDENT';
  department: string | null;
}): Promise<AuthenticatedUser> {
  const id = `it-report-${input.id}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  // Nombre alfabetico de un solo token: evita que BR-011 (apellidos)
  // enmascare las pruebas de BR-004. Cada etiqueta produce un token
  // distinto tras normalizar (p. ej. "pialfa" vs "reviewerbeta").
  const name = input.id.replace(/[^a-z]/gi, '');
  await prisma.user.create({
    data: {
      id,
      name,
      email,
      role: input.role,
      department: input.department,
    },
  });
  createdUserIds.push(id);
  createdEmails.push(email);
  return { id, name, email, role: input.role };
}

async function createProposedProject(
  pi: AuthenticatedUser,
  title: string,
): Promise<number> {
  const project = await prisma.project.create({
    data: {
      title,
      objectives: 'Objetivo de prueba de integración.',
      start_date: new Date('2026-12-01T00:00:00.000Z'),
      end_date: new Date('2027-06-01T00:00:00.000Z'),
      status: 'Proposed',
      is_confidential: false,
      projectUsers: {
        create: {
          user_id: pi.id,
          project_role: 'Principal_Investigator',
        },
      },
    },
    select: { project_id: true },
  });
  createdProjectIds.push(project.project_id);
  return project.project_id;
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }
  for (const file of generatedFiles) {
    await unlink(file).catch(() => undefined);
  }
  await prisma.decision_Report.deleteMany({
    where: { evaluation_id: { in: createdEvaluationIds } },
  });
  await prisma.proposal_Evaluation.deleteMany({
    where: { evaluation_id: { in: createdEvaluationIds } },
  });
  await prisma.project_Status_Transition.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.review_Conflict.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.email_Outbox.deleteMany({
    where: { recipient: { in: createdEmails } },
  });
  await prisma.notification.deleteMany({
    where: { user_id: { in: createdUserIds } },
  });
  await prisma.audit_Log.deleteMany({
    where: {
      OR: [
        { actor_id: { in: createdUserIds } },
        { target_id: { in: createdProjectIds.map(String) } },
      ],
    },
  });
  await prisma.project_User.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.project.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)('Dictamen PDF (integración, F1-10)', () => {
  it('guarda la decisión con dictamen Pending y genera el PDF después', async () => {
    const pi = await createUser({
      id: 'pi',
      role: 'PRINCIPAL_INVESTIGATOR',
      department: 'Ingeniería en Sistemas',
    });
    const reviewer = await createUser({
      id: 'reviewer',
      role: 'COMMITTEE',
      department: 'Ciencias Básicas',
    });
    const projectId = await createProposedProject(
      pi,
      `Proyecto dictamen ${suffix}`,
    );

    const decision = (await submitProjectDecision(reviewer, {
      projectId,
      decision: 'Approved',
      justification: 'El comité avala la propuesta con observaciones menores.',
    })) as unknown as { evaluation_id: number; newStatus: string };
    createdEvaluationIds.push(decision.evaluation_id);

    expect(decision.newStatus).toBe('Approved');

    const project = await prisma.project.findUnique({
      where: { project_id: projectId },
      select: { status: true },
    });
    expect(project?.status).toBe('Approved');

    const pending = await prisma.decision_Report.findUnique({
      where: { evaluation_id: decision.evaluation_id },
      select: { report_id: true, status: true },
    });
    expect(pending?.status).toBe('Pending');

    // La decision ya está disponible aunque el PDF aún no exista.
    const statusWhilePending = await decisionReportStatus(
      pi,
      decision.evaluation_id,
    );
    expect(statusWhilePending.status).toBe('Pending');

    const result = await generateDecisionReport(pending!.report_id);
    expect(result).toBe('ready');

    const ready = await decisionReportStatus(pi, decision.evaluation_id);
    expect(ready.status).toBe('Ready');
    expect(ready.file_path).toBeTruthy();
    generatedFiles.push(ready.file_path as string);

    const pdf = await readFile(ready.file_path as string);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');

    const download = await getDecisionReportForDownload(
      pi,
      decision.evaluation_id,
    );
    expect(download.path).toBe(ready.file_path);
    expect(download.fileName).toContain(`dictamen-${projectId}-`);

    // El comité también puede consultar el dictamen.
    await expect(
      getDecisionReportForDownload(reviewer, decision.evaluation_id),
    ).resolves.toMatchObject({ path: ready.file_path });
  });

  it('oculta el dictamen a usuarios ajenos al proyecto', async () => {
    const pi = await createUser({
      id: 'pi-ajeno',
      role: 'PRINCIPAL_INVESTIGATOR',
      department: 'Ingeniería en Sistemas',
    });
    const reviewer = await createUser({
      id: 'reviewer-ajeno',
      role: 'COMMITTEE',
      department: 'Ciencias Básicas',
    });
    const outsider = await createUser({
      id: 'outsider',
      role: 'STUDENT',
      department: null,
    });
    const projectId = await createProposedProject(
      pi,
      `Proyecto privado ${suffix}`,
    );

    const decision = (await submitProjectDecision(reviewer, {
      projectId,
      decision: 'Rejected',
      justification: 'La propuesta no cumple los criterios de elegibilidad.',
    })) as unknown as { evaluation_id: number };
    createdEvaluationIds.push(decision.evaluation_id);

    await expect(
      decisionReportStatus(outsider, decision.evaluation_id),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    await expect(
      getDecisionReportForDownload(outsider, decision.evaluation_id),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  });
});

describe.skipIf(!dbReady)('Conflicto departamental (integración, BR-004)', () => {
  it('bloquea la evaluación del PI del mismo departamento', async () => {
    const pi = await createUser({
      id: 'pi-depto',
      role: 'PRINCIPAL_INVESTIGATOR',
      department: 'Ingeniería en Sistemas',
    });
    const reviewer = await createUser({
      id: 'reviewer-depto',
      role: 'COMMITTEE',
      department: 'ingenieria en sistemas',
    });
    const projectId = await createProposedProject(
      pi,
      `Proyecto mismo depto ${suffix}`,
    );

    const context = await proposalContext(reviewer, projectId);
    expect(context.canEvaluate).toBe(false);
    expect(context.blockReason).toBe('DEPARTMENT_CONFLICT');

    await expect(
      submitProjectDecision(reviewer, {
        projectId,
        decision: 'Approved',
        justification: 'Intento bloqueado por BR-004.',
      }),
    ).rejects.toMatchObject({
      code: 'DEPARTMENT_CONFLICT',
      httpStatus: 403,
    });

    const evaluations = await prisma.proposal_Evaluation.count({
      where: { project_id: projectId },
    });
    expect(evaluations).toBe(0);
  });

  it('permite evaluar cuando los departamentos difieren', async () => {
    const pi = await createUser({
      id: 'pi-distinto',
      role: 'PRINCIPAL_INVESTIGATOR',
      department: 'Ingeniería en Sistemas',
    });
    const reviewer = await createUser({
      id: 'reviewer-distinto',
      role: 'COMMITTEE',
      department: 'Ciencias Básicas',
    });
    const projectId = await createProposedProject(
      pi,
      `Proyecto distinto depto ${suffix}`,
    );

    const context = await proposalContext(reviewer, projectId);
    expect(context.canEvaluate).toBe(true);
    expect(context.blockReason).toBeNull();

    const decision = (await submitProjectDecision(reviewer, {
      projectId,
      decision: 'Revision_Required',
      justification: 'Se solicita precisar el cronograma de actividades.',
    })) as unknown as { evaluation_id: number };
    createdEvaluationIds.push(decision.evaluation_id);
    expect(decision.evaluation_id).toBeGreaterThan(0);
  });
});
