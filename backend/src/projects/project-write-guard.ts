import { PROJECT_ERROR_CODES } from './projects.constants.js';

/**
 * RF-020: un proyecto archivado es inmutable.
 *
 * El archivado se marca con `Project.is_read_only`; a partir de ese momento
 * ninguna operacion de escritura puede modificar el expediente. Esta guarda
 * es la defensa de aplicacion (no hay triggers de PostgreSQL) y se aplica en
 * todos los puntos de escritura del proyecto.
 */

export const PROJECT_READ_ONLY_MESSAGE =
  'El proyecto esta archivado en modo solo lectura (RF-020). No admite modificaciones.';

export interface ProjectArchiveState {
  is_read_only?: boolean | null;
}

export class ProjectReadOnlyError extends Error {
  readonly code = PROJECT_ERROR_CODES.PROJECT_READ_ONLY;
  readonly httpStatus = 409;
  readonly field = undefined;

  constructor(message: string = PROJECT_READ_ONLY_MESSAGE) {
    super(message);
    this.name = 'ProjectReadOnlyError';
  }
}

/** `true` solo cuando el proyecto fue archivado explicitamente. */
export function isProjectReadOnly(
  project: ProjectArchiveState | null | undefined,
): boolean {
  return project?.is_read_only === true;
}

/** Lanza `ProjectReadOnlyError` (HTTP/GraphQL 409) si el proyecto no admite escrituras. */
export function assertProjectWritable(
  project: ProjectArchiveState | null | undefined,
): void {
  if (isProjectReadOnly(project)) {
    throw new ProjectReadOnlyError();
  }
}
