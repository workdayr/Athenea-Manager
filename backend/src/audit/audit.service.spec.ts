import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    audit_Log: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import { AuditService } from './audit.service.js';

const row = {
  log_id: 9,
  actor_id: 'user-1',
  actor: { name: 'Admin Central' },
  action: 'submit_project_decision:Proposed->Approved',
  target_id: '5',
  source_ip: '10.0.0.1',
  timestamp: new Date('2026-11-13T10:00:00.000Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.audit_Log.findMany.mockResolvedValue([row]);
  prismaMock.audit_Log.count.mockResolvedValue(1);
});

describe('AuditService (F1-08 / RF-017)', () => {
  it('consulta con filtros, orden descendente y paginacion', async () => {
    const page = await new AuditService().query(
      { actorId: 'user-1', action: 'decision' },
      2,
      10,
    );

    expect(prismaMock.audit_Log.findMany).toHaveBeenCalledWith({
      where: {
        actor_id: 'user-1',
        action: { contains: 'decision', mode: 'insensitive' },
      },
      orderBy: { timestamp: 'desc' },
      skip: 10,
      take: 10,
      include: { actor: { select: { name: true } } },
    });
    expect(page).toMatchObject({ total: 1, page: 2, pageSize: 10 });
    expect(page.items[0]).toMatchObject({
      log_id: 9,
      actor_name: 'Admin Central',
    });
  });

  it('usa los valores por defecto', async () => {
    await new AuditService().query();

    expect(prismaMock.audit_Log.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { timestamp: 'desc' },
      skip: 0,
      take: 20,
      include: { actor: { select: { name: true } } },
    });
  });
});
