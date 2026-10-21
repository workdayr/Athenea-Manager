import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { PlanningError } from './planning.errors.js';

const NAME_MAX_LENGTH = 150;

async function requireProject(projectId: number): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    select: { project_id: true },
  });
  if (!project) {
    throw new PlanningError('NOT_FOUND', 'El proyecto no existe.', 'projectId');
  }
}

/** Solo el Investigador Principal del proyecto puede planificar hitos/tareas. */
export async function requireProjectPrincipalInvestigator(
  user: AuthenticatedUser,
  projectId: number,
): Promise<void> {
  await requireProject(projectId);
  const membership = await prisma.project_User.findFirst({
    where: {
      project_id: projectId,
      user_id: user.id,
      project_role: 'Principal_Investigator',
    },
    select: { projectuser_id: true },
  });
  if (!membership) {
    throw new PlanningError(
      'FORBIDDEN',
      'Solo el Investigador Principal del proyecto puede planificar hitos y tareas.',
      'projectId',
    );
  }
}

/** Lectura: cualquier integrante del equipo (o un Administrador). */
export async function requireProjectMember(
  user: AuthenticatedUser,
  projectId: number,
): Promise<void> {
  await requireProject(projectId);
  if (user.role === ROLES.ADMINISTRATOR) {
    return;
  }
  const membership = await prisma.project_User.findFirst({
    where: { project_id: projectId, user_id: user.id },
    select: { projectuser_id: true },
  });
  if (!membership) {
    throw new PlanningError(
      'FORBIDDEN',
      'Solo los integrantes del equipo pueden consultar este proyecto.',
      'projectId',
    );
  }
}

/**
 * Criterio de aceptacion: el responsable debe ser integrante del equipo
 * del proyecto (Project_User), sea investigador o estudiante.
 */
export async function requireTeamAssignee(
  projectId: number,
  assigneeId: string,
): Promise<void> {
  const membership = await prisma.project_User.findFirst({
    where: { project_id: projectId, user_id: assigneeId },
    select: { projectuser_id: true },
  });
  if (!membership) {
    throw new PlanningError(
      'VALIDATION_ERROR',
      'El responsable debe ser integrante del equipo del proyecto.',
      'assigneeId',
    );
  }
}

export function normalizeName(value: string): string {
  const name = value.trim();
  if (name.length === 0) {
    throw new PlanningError(
      'VALIDATION_ERROR',
      'El nombre es obligatorio.',
      'name',
    );
  }
  if (name.length > NAME_MAX_LENGTH) {
    throw new PlanningError(
      'VALIDATION_ERROR',
      `El nombre no puede exceder ${NAME_MAX_LENGTH} caracteres.`,
      'name',
    );
  }
  return name;
}
