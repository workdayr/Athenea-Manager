import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPastDueDate, normalizeMilestoneName } from './milestones.policy.js';

const { db } = vi.hoisted(() => ({
  db: {
    project: { findUnique: vi.fn() },
    project_User: { findFirst: vi.fn(), findMany: vi.fn() },
    milestone: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('../db/prisma.js', () => ({ prisma: db }));
// El servicio importa la subida de evidencia (US 5.2); aqui no se usa.
vi.mock('../document_upload/document-upload.service.js', () => ({
  uploadEvidenceDocument: vi.fn(),
}));

import { MilestonesService } from './milestones.service.js';

const PI = { id: 'pi-1', email: 'pi@x.mx', name: 'PI', role: 'PRINCIPAL_INVESTIGATOR' };
const STUDENT = { id: 'st-1', email: 's@x.mx', name: 'S', role: 'STUDENT' };
const OUTSIDER = { id: 'x-1', email: 'x@x.mx', name: 'X', role: 'STUDENT' };

const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const input = {
  projectId: 7,
  name: '  Entrega de protocolo  ',
  assigneeId: 'st-1',
  dueDate: FUTURE,
};

let service: MilestonesService;

beforeEach(() => {
  vi.resetAllMocks();
  service = new MilestonesService();
  db.project.findUnique.mockResolvedValue({ project_id: 7, is_read_only: false });
  db.milestone.create.mockImplementation(({ data }) =>
    Promise.resolve({
      milestone_id: 1,
      created_at: new Date(),
      assignee: { name: 'Estudiante' },
      ...data,
    }),
  );
  db.milestone.findMany.mockResolvedValue([]);
});

describe('policy', () => {
  it('normaliza el nombre y rechaza vacio o demasiado largo', () => {
    expect(normalizeMilestoneName('  Hito  ')).toBe('Hito');
    expect(normalizeMilestoneName('   ')).toBeNull();
    expect(normalizeMilestoneName('x'.repeat(151))).toBeNull();
  });

  it('rechaza fechas pasadas pero tolera "hoy" en zonas detras de UTC', () => {
    const now = new Date('2026-10-30T02:00:00.000Z'); // 29-oct 20:00 en Durango
    expect(isPastDueDate(new Date('2026-10-29T00:00:00.000Z'), now)).toBe(false);
    expect(isPastDueDate(new Date('2026-10-30T00:00:00.000Z'), now)).toBe(false);
    expect(isPastDueDate(new Date('2026-10-28T00:00:00.000Z'), now)).toBe(true);
  });
});

describe('createMilestone', () => {
  it('crea el hito siempre como Pending, con nombre normalizado', async () => {
    db.project_User.findFirst
      .mockResolvedValueOnce({ projectuser_id: 1 }) // es PI del proyecto
      .mockResolvedValueOnce({ projectuser_id: 2 }); // responsable en el equipo

    const result = await service.createMilestone(PI, input);

    expect(result.name).toBe('Entrega de protocolo');
    expect(result.status).toBe('Pending');
    expect(db.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'Pending', project_id: 7 }),
      }),
    );
  });

  it('rechaza a quien no es PI de ese proyecto', async () => {
    db.project_User.findFirst.mockResolvedValue(null);
    await expect(service.createMilestone(PI, input)).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
    expect(db.milestone.create).not.toHaveBeenCalled();
  });

  it('rechaza un responsable que no es del equipo', async () => {
    db.project_User.findFirst
      .mockResolvedValueOnce({ projectuser_id: 1 })
      .mockResolvedValueOnce(null);
    await expect(service.createMilestone(PI, input)).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', field: 'assigneeId' },
    });
    expect(db.milestone.create).not.toHaveBeenCalled();
  });

  it('rechaza fecha limite anterior a hoy', async () => {
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 1 });
    await expect(
      service.createMilestone(PI, { ...input, dueDate: new Date('2020-01-01') }),
    ).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', field: 'dueDate' },
    });
  });

  it('rechaza nombre vacio', async () => {
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 1 });
    await expect(
      service.createMilestone(PI, { ...input, name: '   ' }),
    ).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', field: 'name' },
    });
  });

  it('rechaza proyectos archivados (RF-020)', async () => {
    db.project.findUnique.mockResolvedValue({ project_id: 7, is_read_only: true });
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 1 });
    await expect(service.createMilestone(PI, input)).rejects.toMatchObject({
      code: expect.any(String),
    });
    expect(db.milestone.create).not.toHaveBeenCalled();
  });

  it('falla con NOT_FOUND si el proyecto no existe', async () => {
    db.project.findUnique.mockResolvedValue(null);
    await expect(service.createMilestone(PI, input)).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND', field: 'projectId' },
    });
  });
});

describe('getMilestones', () => {
  it('niega la lectura a quien no es del equipo (hallazgo 3 de la revision)', async () => {
    db.project_User.findFirst.mockResolvedValue(null);
    await expect(service.getMilestones(OUTSIDER, 7)).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
    expect(db.milestone.findMany).not.toHaveBeenCalled();
  });

  it('un estudiante del equipo solo ve sus propios hitos', async () => {
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 3 });
    await service.getMilestones(STUDENT, 7);
    expect(db.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: 7, assignee_id: 'st-1' },
      }),
    );
  });

  it('el PI del equipo ve todos los hitos del proyecto', async () => {
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 1 });
    await service.getMilestones(PI, 7);
    expect(db.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project_id: 7 } }),
    );
  });
});
