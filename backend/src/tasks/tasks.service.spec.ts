import { prisma } from '../db/prisma.js';
import { createTask, tasksByMilestone } from './tasks.service.js';

jest.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    project_User: { findFirst: jest.fn() },
    milestone: { findUnique: jest.fn() },
    task: { create: jest.fn(), findMany: jest.fn() },
  },
}));

const db = prisma as unknown as {
  project: { findUnique: jest.Mock };
  project_User: { findFirst: jest.Mock };
  milestone: { findUnique: jest.Mock };
  task: { create: jest.Mock; findMany: jest.Mock };
};

const PI = { id: 'pi-1', email: 'pi@x.mx', name: 'PI', role: 'PRINCIPAL_INVESTIGATOR' };
const STUDENT = { id: 'student-1', email: 's@x.mx', name: 'S', role: 'STUDENT' };

const input = {
  milestoneId: 3,
  name: 'Aplicar encuestas',
  assigneeId: 'student-1',
  dueDate: new Date('2026-11-15'),
  status: 'Pending' as const,
};

beforeEach(() => {
  jest.resetAllMocks();
  db.project.findUnique.mockResolvedValue({ project_id: 7 });
  db.milestone.findUnique.mockResolvedValue({ milestone_id: 3, project_id: 7 });
  db.task.create.mockImplementation(({ data }) => ({ task_id: 1, ...data }));
  db.task.findMany.mockResolvedValue([]);
});

describe('createTask', () => {
  it('crea la tarea ligada al hito cuando el responsable es del equipo', async () => {
    db.project_User.findFirst
      .mockResolvedValueOnce({ projectuser_id: 10 })
      .mockResolvedValueOnce({ projectuser_id: 11 });

    const row = await createTask(PI, input);

    expect(row.milestone_id).toBe(3);
    expect(db.task.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza un responsable ajeno al equipo del proyecto del hito', async () => {
    db.project_User.findFirst
      .mockResolvedValueOnce({ projectuser_id: 10 })
      .mockResolvedValueOnce(null);

    await expect(createTask(PI, input)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'assigneeId',
    });
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it('falla con NOT_FOUND si el hito no existe', async () => {
    db.milestone.findUnique.mockResolvedValue(null);
    await expect(createTask(PI, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      field: 'milestoneId',
    });
  });
});

describe('tasksByMilestone', () => {
  it('consulta tareas del hito para un integrante del equipo', async () => {
    db.project_User.findFirst.mockResolvedValue({ projectuser_id: 12 });
    await tasksByMilestone(STUDENT, 3);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { milestone_id: 3 } }),
    );
  });

  it('niega la consulta a quien no es del equipo', async () => {
    db.project_User.findFirst.mockResolvedValue(null);
    await expect(tasksByMilestone(STUDENT, 3)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
