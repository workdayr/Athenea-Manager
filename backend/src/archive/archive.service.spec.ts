import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project_Archive: {
      create: vi.fn(),
    },
  };

  const prisma = {
    project: {
      findMany: vi.fn(),
    },
    archive_Alert: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    email_Outbox: {
      create: vi.fn(),
    },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    ),
  };

  return { prismaMock: prisma, txMock: tx };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import { ProjectArchiveService } from './archive.service.js';

const projectRow = {
  project_id: 5,
  title: 'Proyecto cerrado',
  objectives: 'Objetivo archivado',
  start_date: new Date('2026-01-01T00:00:00.000Z'),
  end_date: new Date('2026-12-31T00:00:00.000Z'),
  status: 'Closed',
  budget_enabled: false,
  is_confidential: false,
  call_id: null,
  call: null,
  projectUsers: [],
  documents: [],
  milestones: [],
  products: [],
  expenses: [],
  evaluations: [],
  conflicts: [],
};

function service() {
  return new ProjectArchiveService();
}

beforeEach(() => {
  vi.resetAllMocks();

  txMock.$queryRaw.mockResolvedValue([
    { status: 'Closed', is_read_only: false },
  ]);
  txMock.project.findUnique.mockResolvedValue(projectRow);
  txMock.project_Archive.create.mockResolvedValue({ archive_id: 11 });
  txMock.project.update.mockResolvedValue({ ...projectRow, is_read_only: true });

  prismaMock.project.findMany.mockResolvedValue([{ project_id: 5 }]);
  prismaMock.archive_Alert.create.mockResolvedValue({ alert_id: 1 });
  prismaMock.user.findMany.mockResolvedValue([
    { id: 'admin-1', email: 'admin@unipolidgo.edu.mx' },
  ]);
  prismaMock.notification.create.mockResolvedValue({ notification_id: 1 });
  prismaMock.email_Outbox.create.mockResolvedValue({ email_id: 1 });
  prismaMock.$transaction.mockImplementation(
    async (callback: (transaction: typeof txMock) => unknown) => callback(txMock),
  );
});

describe('ProjectArchiveService (RF-020)', () => {
  it('archiva un proyecto Closed en una transaccion Serializable', async () => {
    const outcome = await service().archiveProject(5);

    expect(outcome).toMatchObject({
      status: 'archived',
      projectId: 5,
      archiveId: 11,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(txMock.project_Archive.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 5,
        snapshot: expect.objectContaining({
          project: expect.objectContaining({ projectId: 5, status: 'Closed' }),
        }),
        snapshot_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(txMock.project.update).toHaveBeenCalledWith({
      where: { project_id: 5 },
      data: { is_read_only: true, archived_at: expect.any(Date) },
    });
    expect(prismaMock.archive_Alert.create).not.toHaveBeenCalled();
  });

  it('omite un proyecto que dejo de estar Closed antes del lock', async () => {
    txMock.$queryRaw.mockResolvedValue([
      { status: 'Active', is_read_only: false },
    ]);

    const outcome = await service().archiveProject(5);

    expect(outcome).toEqual({
      status: 'skipped',
      projectId: 5,
      reason: 'not_closed',
    });
    expect(txMock.project_Archive.create).not.toHaveBeenCalled();
    expect(txMock.project.update).not.toHaveBeenCalled();
    expect(prismaMock.archive_Alert.create).not.toHaveBeenCalled();
  });

  it('omite un proyecto ya archivado (idempotencia)', async () => {
    txMock.$queryRaw.mockResolvedValue([
      { status: 'Closed', is_read_only: true },
    ]);

    const outcome = await service().archiveProject(5);

    expect(outcome).toEqual({
      status: 'skipped',
      projectId: 5,
      reason: 'already_archived',
    });
    expect(txMock.project_Archive.create).not.toHaveBeenCalled();
  });

  it('omite un proyecto inexistente', async () => {
    txMock.$queryRaw.mockResolvedValue([]);

    const outcome = await service().archiveProject(404);

    expect(outcome).toEqual({
      status: 'skipped',
      projectId: 404,
      reason: 'not_found',
    });
  });

  it('revierte el archivado y alerta si falla la transaccion', async () => {
    txMock.project.update.mockRejectedValue(
      new Error('fallo al marcar solo lectura'),
    );

    const outcome = await service().archiveProject(5);

    expect(outcome).toMatchObject({
      status: 'failed',
      projectId: 5,
      error: 'fallo al marcar solo lectura',
    });
    expect(txMock.project_Archive.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.archive_Alert.create).toHaveBeenCalledWith({
      data: {
        project_id: 5,
        error_message: 'fallo al marcar solo lectura',
      },
    });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMINISTRATOR' },
      select: { id: true, email: true },
    });
    // RF-014: la alerta se convierte en notificacion + correo encolado.
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'admin-1',
        type: 'Archive',
      }),
    });
    expect(prismaMock.email_Outbox.create).toHaveBeenCalled();
  });

  it('trata el conflicto de unicidad como archivado concurrente, sin alertar', async () => {
    prismaMock.$transaction.mockRejectedValue({ code: 'P2002' });

    const outcome = await service().archiveProject(5);

    expect(outcome).toEqual({
      status: 'skipped',
      projectId: 5,
      reason: 'already_archived',
    });
    expect(prismaMock.archive_Alert.create).not.toHaveBeenCalled();
  });

  it('reintenta una vez ante un conflicto de serializacion', async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementation(
        async (callback: (transaction: typeof txMock) => unknown) =>
          callback(txMock),
      );

    const outcome = await service().archiveProject(5);

    expect(outcome).toMatchObject({ status: 'archived', projectId: 5 });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.archive_Alert.create).not.toHaveBeenCalled();
  });

  it('resume el lote y procesa cada proyecto cerrado', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { project_id: 5 },
      { project_id: 6 },
    ]);
    txMock.project.findUnique.mockImplementation(
      async ({ where }: { where: { project_id: number } }) => ({
        ...projectRow,
        project_id: where.project_id,
      }),
    );

    const summary = await service().archiveClosedProjects();

    expect(summary).toEqual({
      scanned: 2,
      archived: 2,
      skipped: 0,
      failed: 0,
    });
    expect(prismaMock.project.findMany).toHaveBeenCalledWith({
      where: {
        status: 'Closed',
        is_read_only: false,
        project_id: { gt: 0 },
      },
      select: { project_id: true },
      orderBy: { project_id: 'asc' },
      take: expect.any(Number),
    });
  });

  it('alerta si falla el job global (sin proyecto concreto)', async () => {
    prismaMock.project.findMany.mockRejectedValue(new Error('BD no disponible'));

    await expect(service().archiveClosedProjects()).rejects.toThrow(
      'BD no disponible',
    );
    expect(prismaMock.archive_Alert.create).toHaveBeenCalledWith({
      data: { project_id: null, error_message: 'BD no disponible' },
    });
  });
});
