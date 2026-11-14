import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    milestone: { update: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    email_Outbox: { create: vi.fn() },
  };
  const prisma = {
    project_User: { findFirst: vi.fn() },
    milestone: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    email_Outbox: { create: vi.fn() },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    ),
  };
  return { prismaMock: prisma, txMock: tx };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../document_upload/document-upload.service.js', () => ({
  uploadEvidenceDocument: vi.fn(),
}));

import { uploadEvidenceDocument } from '../document_upload/document-upload.service.js';
import { MilestonesService } from './milestones.service.js';

const service = new MilestonesService();

const milestoneRow = {
  milestone_id: 1,
  project_id: 10,
  name: 'Tarea',
  assignee_id: 'student-1',
  due_date: new Date('2026-01-01'),
  status: 'Pending',
  assignee: { name: 'Estudiante' },
};

function user(id: string, role: string) {
  return {
    id,
    email: `${id}@unipolidgo.edu.mx`,
    name: id,
    role,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.milestone.findMany.mockResolvedValue([milestoneRow]);
  prismaMock.milestone.findUnique.mockResolvedValue(milestoneRow);
  prismaMock.project.findUnique.mockResolvedValue({ is_read_only: false });
  prismaMock.project_User.findFirst.mockResolvedValue({ projectuser_id: 1 });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'student-1',
    email: 'student-1@unipolidgo.edu.mx',
  });
  prismaMock.notification.create.mockResolvedValue({ notification_id: 1 });
  prismaMock.email_Outbox.create.mockResolvedValue({ email_id: 1 });
  txMock.milestone.update.mockResolvedValue({
    ...milestoneRow,
    status: 'Completed',
  });
  txMock.user.findUnique.mockResolvedValue({
    id: 'student-1',
    email: 'student-1@unipolidgo.edu.mx',
  });
  txMock.notification.create.mockResolvedValue({ notification_id: 1 });
  txMock.email_Outbox.create.mockResolvedValue({ email_id: 1 });
});

describe('getMilestones (RF-001/RF-006)', () => {
  it('el PI miembro ve todos los hitos del proyecto', async () => {
    const rows = await service.getMilestones(
      user('pi-1', 'PRINCIPAL_INVESTIGATOR'),
      10,
    );

    expect(prismaMock.project_User.findFirst).toHaveBeenCalledWith({
      where: { project_id: 10, user_id: 'pi-1' },
    });
    expect(prismaMock.milestone.findMany).toHaveBeenCalledWith({
      where: { project_id: 10 },
      orderBy: { due_date: 'asc' },
      skip: 0,
      take: 50,
      include: { assignee: { select: { name: true } } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      milestoneId: 1,
      assigneeId: 'student-1',
      assigneeName: 'Estudiante',
    });
  });

  it('el estudiante miembro solo ve sus tareas', async () => {
    await service.getMilestones(user('student-1', 'STUDENT'), 10);

    expect(prismaMock.milestone.findMany).toHaveBeenCalledWith({
      where: { project_id: 10, assignee_id: 'student-1' },
      orderBy: { due_date: 'asc' },
      skip: 0,
      take: 50,
      include: { assignee: { select: { name: true } } },
    });
  });

  it('rechaza con FORBIDDEN a quien no pertenece al proyecto', async () => {
    prismaMock.project_User.findFirst.mockResolvedValue(null);

    await expect(
      service.getMilestones(user('outsider', 'PRINCIPAL_INVESTIGATOR'), 10),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    expect(prismaMock.milestone.findMany).not.toHaveBeenCalled();
  });

  it('el coordinador puede leer hitos sin ser miembro', async () => {
    await service.getMilestones(user('coord-1', 'COORDINATOR'), 10);

    expect(prismaMock.project_User.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.milestone.findMany).toHaveBeenCalled();
  });

  it('el administrador puede leer hitos sin ser miembro', async () => {
    await service.getMilestones(user('admin-1', 'ADMINISTRATOR'), 10);

    expect(prismaMock.project_User.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.milestone.findMany).toHaveBeenCalled();
  });

  it('el comite no tiene acceso a la ejecucion del proyecto', async () => {
    prismaMock.project_User.findFirst.mockResolvedValue(null);

    await expect(
      service.getMilestones(user('committee-1', 'COMMITTEE'), 10),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  });
});

describe('confirmMilestone (RF-014)', () => {
  it('confirma la tarea y notifica al asignado en la misma transaccion', async () => {
    const updated = await service.confirmMilestone(
      user('pi-1', 'PRINCIPAL_INVESTIGATOR'),
      1,
    );

    expect(updated).toMatchObject({ status: 'Completed' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.milestone.update).toHaveBeenCalledWith({
      where: { milestone_id: 1 },
      data: { status: 'Completed' },
      include: { assignee: { select: { name: true } } },
    });
    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'student-1',
        type: 'Milestone',
      }),
    });
    expect(txMock.email_Outbox.create).toHaveBeenCalled();
  });

  it('no se notifica a si mismo cuando el PI es el asignado', async () => {
    prismaMock.milestone.findUnique.mockResolvedValue({
      ...milestoneRow,
      assignee_id: 'pi-1',
    });

    await service.confirmMilestone(user('pi-1', 'PRINCIPAL_INVESTIGATOR'), 1);

    expect(txMock.notification.create).not.toHaveBeenCalled();
  });

  it('rechaza a un rol distinto del PI', async () => {
    await expect(
      service.confirmMilestone(user('student-1', 'STUDENT'), 1),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  });
});

describe('uploadEvidenceAndComplete (RF-014)', () => {
  it('notifica al PI sin revertir la evidencia si el aviso falla', async () => {
    prismaMock.project_User.findFirst.mockResolvedValue({ user_id: 'pi-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'pi-1',
      email: 'pi-1@unipolidgo.edu.mx',
    });
    prismaMock.notification.create.mockRejectedValue(new Error('BD caida'));

    await expect(
      service.uploadEvidenceAndComplete(
        user('student-1', 'STUDENT'),
        1,
        { buffer: Buffer.from('pdf'), originalname: 'evidencia.pdf', size: 3 },
        '10.0.0.1',
      ),
    ).resolves.toBeTruthy();

    expect(uploadEvidenceDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'student-1' }),
      10,
      expect.any(Object),
      '10.0.0.1',
      { milestoneId: 1 },
    );
    expect(prismaMock.project_User.findFirst).toHaveBeenCalledWith({
      where: {
        project_id: 10,
        project_role: 'Principal_Investigator',
      },
      select: { user_id: true },
    });
  });
});
