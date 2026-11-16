import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { MilestonesService } from './milestones.service.js';

/**
 * Integracion real contra PostgreSQL de hitos (F2-07 / RF-006 / BR-008):
 * alta por PI, visibilidad por rol, reporte de avance, reasignacion,
 * reinicio de avisos al cambiar la fecha y proteccion del borrado cuando
 * existe evidencia. Tambien verifica auditoria y notificaciones.
 *
 * Los proyectos son unicos por ejecucion y se eliminan en afterAll.
 * Si la base no esta disponible las pruebas se omiten.
 */

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

type TestRole = 'PRINCIPAL_INVESTIGATOR' | 'STUDENT';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const service = new MilestonesService();
const ip = '127.0.0.1';

const userIds: string[] = [];
const emails: string[] = [];
const projectIds: number[] = [];

let pi: AuthenticatedUser;
let student: AuthenticatedUser;
let otherStudent: AuthenticatedUser;

async function createUser(
  role: TestRole,
  label: string,
): Promise<AuthenticatedUser> {
  const id = `it-milestone-${label}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  const name = `Prueba hito ${label}`;
  await prisma.user.create({ data: { id, name, email, role } });
  userIds.push(id);
  emails.push(email);
  return { id, email, name, role };
}

async function createProject(label: string): Promise<number> {
  const project = await prisma.project.create({
    data: {
      title: `Proyecto hitos ${label} ${suffix}`,
      objectives: `Objetivos de la prueba de hitos ${suffix}`,
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2027-12-31T00:00:00.000Z'),
      status: 'Active',
      is_confidential: false,
    },
  });
  projectIds.push(project.project_id);
  await prisma.project_User.createMany({
    data: [
      {
        project_id: project.project_id,
        user_id: pi.id,
        project_role: 'Principal_Investigator',
      },
      {
        project_id: project.project_id,
        user_id: student.id,
        project_role: 'Assistant',
      },
      {
        project_id: project.project_id,
        user_id: otherStudent.id,
        project_role: 'Assistant',
      },
    ],
  });
  return project.project_id;
}

function dueDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function scanDate(daysFromNow: number): Date {
  return new Date(Date.UTC(2000, 5, 15, 18) + daysFromNow * DAY_MS);
}

async function createScanMilestone(
  projectId: number,
  label: string,
  input: {
    dueDate: Date;
    lastProgressAt: Date;
    status?: 'Pending' | 'Delayed' | 'Completed';
  },
) {
  return prisma.milestone.create({
    data: {
      project_id: projectId,
      name: `Hito scan ${label}`,
      assignee_id: student.id,
      due_date: input.dueDate,
      last_progress_at: input.lastProgressAt,
      status: input.status ?? 'Pending',
    },
  });
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }
  await prisma.projectDocument.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.milestone.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.project_User.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.project.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.email_Outbox.deleteMany({
    where: { recipient: { in: emails } },
  });
  await prisma.notification.deleteMany({
    where: { user_id: { in: userIds } },
  });
  await prisma.audit_Log.deleteMany({
    where: { actor_id: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)('Hitos (integracion, F2-07)', () => {
  beforeAll(async () => {
    if (!dbReady) {
      return;
    }
    pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi');
    student = await createUser('STUDENT', 'estudiante');
    otherStudent = await createUser('STUDENT', 'otro');
  });

  it('el PI crea un hito, lo audita y notifica al asignado', async () => {
    const projectId = await createProject('alta');

    const milestone = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito de prueba de alta',
        assigneeId: student.id,
        dueDate: dueDate(30),
      },
      ip,
    );

    expect(milestone.projectId).toBe(projectId);
    expect(milestone.assigneeId).toBe(student.id);
    expect(milestone.status).toBe('Pending');

    const stored = await prisma.milestone.findUnique({
      where: { milestone_id: milestone.milestoneId },
    });
    expect(stored).not.toBeNull();
    expect(stored?.last_progress_at).toBeInstanceOf(Date);
    expect(stored?.due_notice_days).toBe(0);

    const audit = await prisma.audit_Log.findFirst({
      where: {
        actor_id: pi.id,
        action: 'milestone_created',
        target_id: String(milestone.milestoneId),
      },
    });
    expect(audit).not.toBeNull();

    const notification = await prisma.notification.findFirst({
      where: { user_id: student.id, type: 'Milestone' },
    });
    expect(notification?.title).toContain('Nuevo hito');
  });

  it('rechaza el alta cuando el actor no es PI del proyecto', async () => {
    const projectId = await createProject('permiso');

    await expect(
      service.createMilestone(
        student,
        {
          projectId,
          name: 'Hito no autorizado',
          assigneeId: student.id,
          dueDate: dueDate(30),
        },
        ip,
      ),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });

    const count = await prisma.milestone.count({ where: { project_id: projectId } });
    expect(count).toBe(0);
  });

  it('el PI ve todos los hitos y el estudiante solo los suyos', async () => {
    const projectId = await createProject('visibilidad');
    const own = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito del estudiante',
        assigneeId: student.id,
        dueDate: dueDate(20),
      },
      ip,
    );
    await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito de otro estudiante',
        assigneeId: otherStudent.id,
        dueDate: dueDate(20),
      },
      ip,
    );

    const piView = await service.getMilestones(pi, projectId);
    expect(piView).toHaveLength(2);

    const studentView = await service.getMilestones(student, projectId);
    expect(studentView).toHaveLength(1);
    expect(studentView[0].milestoneId).toBe(own.milestoneId);
  });

  it('el asignado reporta avance y se notifica al PI', async () => {
    const projectId = await createProject('avance');
    const milestone = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito para completar',
        assigneeId: student.id,
        dueDate: dueDate(10),
      },
      ip,
    );

    const updated = await service.updateMilestoneProgress(
      student,
      milestone.milestoneId,
      'Completed',
      ip,
    );
    expect(updated.status).toBe('Completed');

    const stored = await prisma.milestone.findUnique({
      where: { milestone_id: milestone.milestoneId },
    });
    expect(stored?.status).toBe('Completed');
    expect(stored?.last_progress_at.getTime()).toBeGreaterThanOrEqual(
      milestone.lastProgressAt.getTime(),
    );

    const audit = await prisma.audit_Log.findFirst({
      where: {
        actor_id: student.id,
        action: 'milestone_completed',
        target_id: String(milestone.milestoneId),
      },
    });
    expect(audit).not.toBeNull();

    const notification = await prisma.notification.findFirst({
      where: { user_id: pi.id, type: 'Milestone' },
    });
    expect(notification?.title).toContain('Hito completado');
  });

  it('reasigna el hito y notifica al nuevo asignado', async () => {
    const projectId = await createProject('reasigna');
    const milestone = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito para reasignar',
        assigneeId: student.id,
        dueDate: dueDate(15),
      },
      ip,
    );

    const updated = await service.assignMilestone(
      pi,
      milestone.milestoneId,
      otherStudent.id,
      ip,
    );
    expect(updated.assigneeId).toBe(otherStudent.id);

    const stored = await prisma.milestone.findUnique({
      where: { milestone_id: milestone.milestoneId },
    });
    expect(stored?.assignee_id).toBe(otherStudent.id);

    const notification = await prisma.notification.findFirst({
      where: {
        user_id: otherStudent.id,
        type: 'Milestone',
        title: 'Hito asignado',
      },
    });
    expect(notification).not.toBeNull();
  });

  it('al cambiar la fecha reinicia el control de avisos de BR-008', async () => {
    const projectId = await createProject('fecha');
    const milestone = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito con aviso enviado',
        assigneeId: student.id,
        dueDate: dueDate(25),
      },
      ip,
    );
    await prisma.milestone.update({
      where: { milestone_id: milestone.milestoneId },
      data: { due_notice_days: 15 },
    });

    const updated = await service.updateMilestone(
      pi,
      milestone.milestoneId,
      { dueDate: dueDate(40) },
      ip,
    );

    expect(updated.dueDate.toISOString().slice(0, 10)).toBe(dueDate(40));
    const stored = await prisma.milestone.findUnique({
      where: { milestone_id: milestone.milestoneId },
    });
    expect(stored?.due_notice_days).toBe(0);
  });

  it('elimina un hito sin evidencia y audita la accion', async () => {
    const projectId = await createProject('borrado');
    const milestone = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito para eliminar',
        assigneeId: student.id,
        dueDate: dueDate(5),
      },
      ip,
    );

    await expect(
      service.deleteMilestone(pi, milestone.milestoneId, ip),
    ).resolves.toBe(true);

    const stored = await prisma.milestone.findUnique({
      where: { milestone_id: milestone.milestoneId },
    });
    expect(stored).toBeNull();

    const audit = await prisma.audit_Log.findFirst({
      where: {
        actor_id: pi.id,
        action: 'milestone_deleted',
        target_id: String(milestone.milestoneId),
      },
    });
    expect(audit).not.toBeNull();
  });

  it('el barrido marca retrasados por inactividad y por vencimiento, sin tocar completados', async () => {
    const projectId = await createProject('scan-retrasos');
    const now = scanDate(0);
    const inactive = await createScanMilestone(projectId, 'inactivo', {
      dueDate: scanDate(15),
      lastProgressAt: scanDate(-8),
    });
    const overdue = await createScanMilestone(projectId, 'vencido', {
      dueDate: scanDate(-2),
      lastProgressAt: scanDate(-1),
    });
    const completed = await createScanMilestone(projectId, 'completado', {
      dueDate: scanDate(-10),
      lastProgressAt: scanDate(-30),
      status: 'Completed',
    });

    const summary = await service.runDailyScan(now);

    // Solo los hitos con fechas de 2000 caen en el corte del barrido.
    expect(summary.delayed).toBe(2);
    expect(summary.notices).toBe(1);

    const rows = await prisma.milestone.findMany({
      where: { milestone_id: { in: [inactive.milestone_id, overdue.milestone_id, completed.milestone_id] } },
    });
    const byId = new Map(rows.map((row) => [row.milestone_id, row]));
    expect(byId.get(inactive.milestone_id)?.status).toBe('Delayed');
    expect(byId.get(overdue.milestone_id)?.status).toBe('Delayed');
    expect(byId.get(completed.milestone_id)?.status).toBe('Completed');

    const overdueNotice = await prisma.notification.findFirst({
      where: {
        user_id: student.id,
        title: 'Hito retrasado',
        message: { contains: 'vencio hace 2 dia(s)' },
      },
    });
    expect(overdueNotice).not.toBeNull();

    const inactiveNotice = await prisma.notification.findFirst({
      where: {
        user_id: student.id,
        title: 'Hito retrasado',
        message: { contains: 'sin avance' },
      },
    });
    expect(inactiveNotice).not.toBeNull();
  });

  it('envia los avisos 30/15/5 una sola vez y no los duplica en el siguiente barrido', async () => {
    const projectId = await createProject('scan-avisos');
    const now = scanDate(100);
    const cases = [
      { label: 'aviso-5', days: 3, threshold: 5 },
      { label: 'aviso-15', days: 10, threshold: 15 },
      { label: 'aviso-30', days: 20, threshold: 30 },
    ];
    const ids: number[] = [];
    for (const item of cases) {
      const milestone = await createScanMilestone(projectId, item.label, {
        dueDate: scanDate(100 + item.days),
        lastProgressAt: scanDate(99),
      });
      ids.push(milestone.milestone_id);
    }

    const first = await service.runDailyScan(now);
    expect(first.delayed).toBe(0);
    expect(first.notices).toBe(3);

    const rows = await prisma.milestone.findMany({
      where: { milestone_id: { in: ids } },
    });
    const noticeByMilestone = new Map(
      rows.map((row) => [row.milestone_id, row.due_notice_days]),
    );
    for (const item of cases) {
      const id = ids[cases.indexOf(item)];
      expect(noticeByMilestone.get(id)).toBe(item.threshold);
    }

    const second = await service.runDailyScan(now);
    expect(second.delayed).toBe(0);
    expect(second.notices).toBe(0);

    // Cada aviso notifica al asignado y al PI: 3 avisos x 2 destinatarios.
    const notices = await prisma.notification.count({
      where: {
        user_id: { in: [student.id, pi.id] },
        title: { startsWith: 'Aviso: hito por vencer' },
        message: { contains: 'Hito scan aviso-' },
      },
    });
    expect(notices).toBe(6);
  });

  it('no elimina un hito que ya tiene evidencia documental', async () => {
    const projectId = await createProject('evidencia');
    const milestone = await service.createMilestone(
      pi,
      {
        projectId,
        name: 'Hito con evidencia',
        assigneeId: student.id,
        dueDate: dueDate(8),
      },
      ip,
    );
    await prisma.projectDocument.create({
      data: {
        project_id: projectId,
        milestone_id: milestone.milestoneId,
        doc_type: 'evidence',
        visibility: 'Team_only',
        file_url: '/uploads/integration-evidence.pdf',
        version: 1,
      },
    });

    await expect(
      service.deleteMilestone(pi, milestone.milestoneId, ip),
    ).rejects.toMatchObject({
      extensions: { code: 'MILESTONE_HAS_EVIDENCE' },
    });

    const stored = await prisma.milestone.findUnique({
      where: { milestone_id: milestone.milestoneId },
    });
    expect(stored).not.toBeNull();
  });
});
