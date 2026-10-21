import { prisma } from '../db/prisma.js';
import { createMilestone } from './milestones.service.js';

jest.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    project_User: { findFirst: jest.fn() },
    milestone: { create: jest.fn(), findMany: jest.fn() },
  },
}));

const db = prisma as unknown as {
  project: { findUnique: jest.Mock };
  project_User: { findFirst: jest.Mock };
  milestone: { create: jest.Mock };
};

const PI = { id: 'pi-1', email: 'pi@x.mx', name: 'PI', role: 'PRINCIPAL_INVESTIGATOR' };

const input = {
  projectId: 1,
  name: '  Entrega de protocolo  ',
  assigneeId: 'student-1',
  dueDate: new Date('2026-12-01'),
  status: 'Pending' as const,
};

beforeEach(() => {
  jest.resetAllMocks();
  db.project.findUnique.mockResolvedValue({ project_id: 1 });
  db.milestone.create.mockImplementation(({ data }) => ({ milestone_id: 1, ...data }));
});

describe('createMilestone', () => {
  it('crea el hito con nombre normalizado cuando el responsable es del equipo', async () => {
    db.project_User.findFirst
      .mockResolvedValueOnce({ projectuser_id: 10 }) // PI del proyecto
      .mockResolvedValueOnce({ projectuser_id: 11 }); // responsable

    const row = await createMilestone(PI, input);

    expect(row.name).toBe('Entrega de protocolo');
    expect(db.milestone.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza un responsable que no pertenece al equipo', async () => {
    db.project_User.findFirst
      .mockResolvedValueOnce({ projectuser_id: 10 })
      .mockResolvedValueOnce(null);

    await expect(createMilestone(PI, input)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'assigneeId',
    });
    expect(db.milestone.create).not.toHaveBeenCalled();
  });

  it('rechaza a quien no es el PI del proyecto', async () => {
    db.project_User.findFirst.mockResolvedValue(null);
    await expect(createMilestone(PI, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rechaza un nombre vacio', async () => {
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 10 });
    await expect(
      createMilestone(PI, { ...input, name: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'name' });
  });
});
