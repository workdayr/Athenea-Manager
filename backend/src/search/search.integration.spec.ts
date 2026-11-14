import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { SearchService } from './search.service.js';

/**
 * Integracion real contra PostgreSQL de la busqueda transversal
 * (F2-01 / RF-012): FTS sobre las columnas generadas, filtros por tipo,
 * paginacion y reglas de visibilidad de BR-007.
 *
 * Los datos llevan un token unico por ejecucion y se eliminan en afterAll.
 * Si la base no esta disponible las pruebas se omiten.
 */

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

type TestRole =
  | 'ADMINISTRATOR'
  | 'STUDENT'
  | 'PRINCIPAL_INVESTIGATOR';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const token = `busqueda${suffix.replace(/[^a-z0-9]/gi, '')}`;
const service = new SearchService();

const userIds: string[] = [];
const emails: string[] = [];
const projectIds: number[] = [];
const callIds: number[] = [];

let admin: AuthenticatedUser;
let student: AuthenticatedUser;
let principalInvestigator: AuthenticatedUser;
let publicProjectId: number;
let studentConfidentialProjectId: number;
let otherConfidentialProjectId: number;
let draftCallId: number;
let openCallId: number;

async function createUser(
  role: TestRole,
  label: string,
): Promise<AuthenticatedUser> {
  const id = `it-search-${label}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  const name = `${token} ${label}`;
  await prisma.user.create({ data: { id, name, email, role } });
  userIds.push(id);
  emails.push(email);
  return { id, email, name, role };
}

async function createProject(input: {
  title: string;
  isConfidential: boolean;
  memberId?: string;
  memberRole?: 'Principal_Investigator' | 'Assistant';
}): Promise<number> {
  const project = await prisma.project.create({
    data: {
      title: `${token} ${input.title}`,
      objectives: `Objetivos de ${token}`,
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T00:00:00.000Z'),
      status: 'Active',
      is_confidential: input.isConfidential,
    },
  });
  projectIds.push(project.project_id);

  if (input.memberId) {
    await prisma.project_User.create({
      data: {
        project_id: project.project_id,
        user_id: input.memberId,
        project_role: input.memberRole ?? 'Assistant',
      },
    });
  }
  return project.project_id;
}

async function createCall(
  status: 'DRAFT' | 'OPEN',
  label: string,
): Promise<number> {
  const call = await prisma.announcement.create({
    data: {
      title: `${token} convocatoria ${label}`,
      description: `Descripcion de ${token}`,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      application_cap: 10,
      application_count: 0,
      status,
    },
  });
  callIds.push(call.call_id);
  return call.call_id;
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }
  await prisma.project_User.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.project.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.announcement.deleteMany({
    where: { call_id: { in: callIds } },
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

describe.skipIf(!dbReady)('Busqueda interna (integracion, RF-012)', () => {
  beforeAll(async () => {
    if (!dbReady) {
      return;
    }
    admin = await createUser('ADMINISTRATOR', 'admin');
    student = await createUser('STUDENT', 'estudiante');
    principalInvestigator = await createUser(
      'PRINCIPAL_INVESTIGATOR',
      'investigador',
    );

    publicProjectId = await createProject({
      title: 'proyecto publico',
      isConfidential: false,
    });
    studentConfidentialProjectId = await createProject({
      title: 'proyecto confidencial propio',
      isConfidential: true,
      memberId: student.id,
      memberRole: 'Assistant',
    });
    otherConfidentialProjectId = await createProject({
      title: 'proyecto confidencial ajeno',
      isConfidential: true,
      memberId: principalInvestigator.id,
      memberRole: 'Principal_Investigator',
    });

    draftCallId = await createCall('DRAFT', 'borrador');
    openCallId = await createCall('OPEN', 'abierta');
  });

  it('el administrador encuentra proyectos, convocatorias y usuarios', async () => {
    const page = await service.search(admin, token, undefined, 1, 50);
    const keys = new Set(page.items.map((item) => `${item.type}:${item.id}`));

    expect(page.total).toBe(8);
    expect(page.items).toHaveLength(8);
    expect(keys).toContain(`PROJECT:${publicProjectId}`);
    expect(keys).toContain(`PROJECT:${studentConfidentialProjectId}`);
    expect(keys).toContain(`PROJECT:${otherConfidentialProjectId}`);
    expect(keys).toContain(`CALL:${draftCallId}`);
    expect(keys).toContain(`CALL:${openCallId}`);
    expect(keys).toContain(`USER:${admin.id}`);
    expect(keys).toContain(`USER:${student.id}`);
    expect(keys).toContain(`USER:${principalInvestigator.id}`);
    expect(
      page.items.find((item) => item.type === 'PROJECT')?.link,
    ).toMatch(/^\/projects\/\d+$/);
  });

  it('filtra por tipo PROJECT y pagina sin solapamientos', async () => {
    const projects = await service.search(admin, token, ['PROJECT'], 1, 50);
    expect(projects.total).toBe(3);
    expect(projects.items).toHaveLength(3);
    expect(projects.items.every((item) => item.type === 'PROJECT')).toBe(true);

    const first = await service.search(admin, token, undefined, 1, 3);
    const second = await service.search(admin, token, undefined, 2, 3);

    expect(first.total).toBe(8);
    expect(second.total).toBe(8);
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(3);

    const firstIds = new Set(first.items.map((item) => item.id));
    expect(second.items.some((item) => firstIds.has(item.id))).toBe(false);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(second.pageInfo.hasPreviousPage).toBe(true);
  });

  it('el estudiante no ve usuarios, borradores ni proyectos confidenciales ajenos', async () => {
    const page = await service.search(student, token, undefined, 1, 50);
    const projectIdsFound = page.items
      .filter((item) => item.type === 'PROJECT')
      .map((item) => Number(item.id));
    const callIdsFound = page.items
      .filter((item) => item.type === 'CALL')
      .map((item) => Number(item.id));

    expect(page.items.some((item) => item.type === 'USER')).toBe(false);
    expect(projectIdsFound).toContain(publicProjectId);
    expect(projectIdsFound).toContain(studentConfidentialProjectId);
    expect(projectIdsFound).not.toContain(otherConfidentialProjectId);
    expect(callIdsFound).toContain(openCallId);
    expect(callIdsFound).not.toContain(draftCallId);
  });

  it('rechaza consultas demasiado cortas con VALIDATION_ERROR', async () => {
    await expect(service.search(admin, 'a', undefined)).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', field: 'query' },
    });
  });

  it('rechaza tipos desconocidos con VALIDATION_ERROR', async () => {
    await expect(
      service.search(admin, token, ['INVALID' as never]),
    ).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', field: 'types' },
    });
  });
});
