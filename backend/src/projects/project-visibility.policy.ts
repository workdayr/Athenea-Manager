import type { Prisma } from '../generated/prisma/client.js';
import { ROLES } from '../auth/roles.constants.js';

/**
 * BR-007: un proyecto confidencial solo es visible para su equipo y para
 * los administradores generales. Este helper se comparte entre la consulta
 * de proyecto, el historial de estados y los listados institucionales.
 */

export interface ProjectViewer {
  id: string;
  role: string;
}

/** `true` si el usuario puede ver un proyecto confidencial. */
export function canViewConfidentialProject(
  viewer: ProjectViewer,
  isTeamMember: boolean,
): boolean {
  return isTeamMember || viewer.role === ROLES.ADMINISTRATOR;
}

/**
 * Filtro Prisma para listados institucionales: los roles no administradores
 * solo ven proyectos no confidenciales o aquellos donde son miembros.
 * Devuelve `null` cuando no hace falta filtrar (administrador).
 */
export function confidentialProjectFilter(
  viewer: ProjectViewer,
): Prisma.ProjectWhereInput | null {
  if (viewer.role === ROLES.ADMINISTRATOR) {
    return null;
  }
  return {
    OR: [
      { is_confidential: false },
      { projectUsers: { some: { user_id: viewer.id } } },
    ],
  };
}
