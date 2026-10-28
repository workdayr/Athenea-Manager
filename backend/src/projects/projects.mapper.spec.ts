import { describe, expect, it } from 'vitest';
import { toProjectGql, type ProjectRow } from './projects.mapper.js';
import type { AuthenticatedUser } from './session.guard.js';

const BASE_ROW: ProjectRow = {
  project_id: 7,
  title: 'PruebaMilestones',
  objectives: 'Objetivo de prueba',
  start_date: new Date('2026-10-20T00:00:00.000Z'),
  end_date: new Date('2026-10-23T00:00:00.000Z'),
  status: 'Proposed',
  call_id: 12,
  budget_enabled: true,
  call: { title: 'Convocatoria de prueba' },
  projectUsers: [
    {
      project_role: 'Principal_Investigator',
      user: { name: 'Julio Cesar de la Cruz Gurrola' },
    },
    {
      project_role: 'Assistant',
      user: { name: 'Steve Rodarte' },
    },
  ],
  milestones: [
    { status: 'Completed' },
    { status: 'Pending' },
    { status: 'Delayed' },
  ],
  expenses: [{ amount: 1500.5 }, { amount: 249.5 }],
};

const PRINCIPAL_INVESTIGATOR: AuthenticatedUser = {
  id: 'user-pi',
  email: 'pi@unipolidgo.edu.mx',
  name: 'PI de Prueba',
  role: 'PRINCIPAL_INVESTIGATOR',
};

const STUDENT: AuthenticatedUser = {
  id: 'user-student',
  email: 'student@unipolidgo.edu.mx',
  name: 'Estudiante de Prueba',
  role: 'STUDENT',
};

describe('toProjectGql', () => {
  it('mapea PI, equipo, convocatoria, hitos y gasto real', () => {
    const project = toProjectGql(BASE_ROW, PRINCIPAL_INVESTIGATOR);

    expect(project.projectId).toBe(7);
    expect(project.title).toBe('PruebaMilestones');
    expect(project.piName).toBe('Julio Cesar de la Cruz Gurrola');
    expect(project.callTitle).toBe('Convocatoria de prueba');
    expect(project.team).toHaveLength(2);
    expect(project.team[1]).toMatchObject({
      name: 'Steve Rodarte',
      role: 'Assistant',
    });
    expect(project.milestonesTotal).toBe(3);
    expect(project.milestonesCompleted).toBe(1);
    expect(project.budgetEnabled).toBe(true);
    expect(project.budgetSpent).toBe(1750);
  });

  it('oculta el gasto a roles distintos del PI', () => {
    const project = toProjectGql(BASE_ROW, STUDENT);

    expect(project.budgetSpent).toBeNull();
    expect(project.budgetEnabled).toBe(true);
    expect(project.piName).toBe('Julio Cesar de la Cruz Gurrola');
  });

  it('oculta el gasto cuando no hay usuario autenticado', () => {
    const project = toProjectGql(BASE_ROW);

    expect(project.budgetSpent).toBeNull();
  });

  it('usa valores seguros cuando la fila no trae relaciones', () => {
    const project = toProjectGql(
      {
        project_id: 9,
        title: 'Proyecto recién creado',
        objectives: 'Objetivo',
        start_date: new Date('2026-01-01T00:00:00.000Z'),
        end_date: new Date('2026-12-31T00:00:00.000Z'),
        status: 'Draft',
        call_id: null,
      },
      PRINCIPAL_INVESTIGATOR,
    );

    expect(project.piName).toBeNull();
    expect(project.callTitle).toBeNull();
    expect(project.team).toEqual([]);
    expect(project.milestonesTotal).toBe(0);
    expect(project.milestonesCompleted).toBe(0);
    expect(project.budgetEnabled).toBe(false);
    expect(project.budgetSpent).toBe(0);
  });
});
