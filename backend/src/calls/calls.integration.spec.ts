import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../db/prisma.js';
import {
  registerProject,
  type ProjectError,
} from '../projects/projects.service.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';

/**
 * Integración real contra PostgreSQL del flujo de postulación a una
 * convocatoria (F1-09 / RF-018): creación en Draft, consumo de cupo,
 * postulación duplicada, convocatoria cerrada y cierre por cupo.
 *
 * Los datos son únicos por ejecución y se eliminan en `afterAll`. Si la
 * base no está disponible las pruebas se omiten (CI sin PostgreSQL).
 * La transacción usa `SELECT ... FOR UPDATE`, por lo que DATABASE_URL debe
 * apuntar a una conexión directa (no al pooler en modo transacción).
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
const createdCallIds: number[] = [];
const createdEmails: string[] = [];

async function createUser(
  role: 'PRINCIPAL_INVESTIGATOR' | 'STUDENT',
  label: string,
): Promise<AuthenticatedUser> {
  const id = `it-call-${label}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  const name = `Prueba ${label}`;
  await prisma.user.create({ data: { id, name, email, role } });
  createdUserIds.push(id);
  createdEmails.push(email);
  return { id, email, name, role };
}

async function createCall(input: {
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  cap: number;
  count?: number;
}): Promise<number> {
  const call = await prisma.announcement.create({
    data: {
      title: `Convocatoria de prueba ${suffix}`,
      description: 'Creada por las pruebas de integración.',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      application_cap: input.cap,
      application_count: input.count ?? 0,
      status: input.status,
    },
  });
  createdCallIds.push(call.call_id);
  return call.call_id;
}

function projectInput(callId: number) {
  return {
    title: `Propuesta de prueba ${suffix}`,
    objectives: 'Objetivo de la prueba de integración.',
    startDate: new Date('2026-12-01T00:00:00.000Z'),
    endDate: new Date('2027-06-01T00:00:00.000Z'),
    callId,
  };
}

async function expectProjectError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code,
  } satisfies Partial<ProjectError>);
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }
  const projects = await prisma.project.findMany({
    where: { projectUsers: { some: { user_id: { in: createdUserIds } } } },
    select: { project_id: true },
  });
  const projectIds = projects.map((project) => project.project_id);

  await prisma.project_User.deleteMany({
    where: {
      OR: [
        { project_id: { in: projectIds } },
        { user_id: { in: createdUserIds } },
      ],
    },
  });
  await prisma.project.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.announcement.deleteMany({
    where: { call_id: { in: createdCallIds } },
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
        { target_id: { in: createdUserIds } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)(
  'Postulación a convocatoria (integración, RF-018)',
  () => {
    it('crea el proyecto en Draft, vincula al PI y consume un cupo', async () => {
      const user = await createUser('PRINCIPAL_INVESTIGATOR', 'happy');
      const callId = await createCall({ status: 'OPEN', cap: 2 });

      const project = (await registerProject(user, projectInput(callId))) as {
        project_id: number;
        status: string;
        call_id: number;
      };

      expect(project.status).toBe('Draft');
      expect(project.call_id).toBe(callId);

      const membership = await prisma.project_User.findFirst({
        where: { project_id: project.project_id, user_id: user.id },
        select: { project_role: true },
      });
      expect(membership?.project_role).toBe('Principal_Investigator');

      const call = await prisma.announcement.findUnique({
        where: { call_id: callId },
        select: { application_count: true, status: true },
      });
      expect(call?.application_count).toBe(1);
      expect(call?.status).toBe('OPEN');
    });

    it('rechaza una segunda postulación del mismo PI con ALREADY_APPLIED', async () => {
      const user = await createUser('PRINCIPAL_INVESTIGATOR', 'duplicada');
      const callId = await createCall({ status: 'OPEN', cap: 3 });

      await registerProject(user, projectInput(callId));
      await expectProjectError(
        registerProject(user, projectInput(callId)),
        'ALREADY_APPLIED',
      );

      // El cupo no se consumió dos veces.
      const call = await prisma.announcement.findUnique({
        where: { call_id: callId },
        select: { application_count: true },
      });
      expect(call?.application_count).toBe(1);
    });

    it('rechaza postular a una convocatoria cerrada con CALL_CLOSED', async () => {
      const user = await createUser('PRINCIPAL_INVESTIGATOR', 'cerrada');
      const callId = await createCall({ status: 'CLOSED', cap: 2 });

      await expectProjectError(
        registerProject(user, projectInput(callId)),
        'CALL_CLOSED',
      );

      const projects = await prisma.project.count({
        where: { call_id: callId },
      });
      expect(projects).toBe(0);
    });

    it('rechaza con CALL_FULL y cierra la convocatoria al llenarse el cupo', async () => {
      const user = await createUser('PRINCIPAL_INVESTIGATOR', 'llena');
      const callId = await createCall({
        status: 'OPEN',
        cap: 1,
        count: 1,
      });

      await expectProjectError(
        registerProject(user, projectInput(callId)),
        'CALL_FULL',
      );

      const projects = await prisma.project.count({
        where: { call_id: callId },
      });
      expect(projects).toBe(0);

      const call = await prisma.announcement.findUnique({
        where: { call_id: callId },
        select: { status: true, application_count: true },
      });
      expect(call?.status).toBe('CLOSED');
      expect(call?.application_count).toBe(1);
    });

    it('cierra la convocatoria cuando la última postulación completa el cupo', async () => {
      const user = await createUser('PRINCIPAL_INVESTIGATOR', 'ultima');
      const callId = await createCall({ status: 'OPEN', cap: 1 });

      await registerProject(user, projectInput(callId));

      const call = await prisma.announcement.findUnique({
        where: { call_id: callId },
        select: { status: true, application_count: true },
      });
      expect(call?.application_count).toBe(1);
      expect(call?.status).toBe('CLOSED');
    });
  },
);
