/**
 * Constantes para versiones de propuestas de proyectos (RF-004 / UC-004).
 */

/** RF-004: maximo de versiones retenidas por proyecto. */
export const MAX_PROPOSAL_VERSIONS = 5;

export const PROPOSAL_COMMENT_MAX_LENGTH = 4000;

export const PROPOSAL_VERSION_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERSION_LIMIT_REACHED: 'VERSION_LIMIT_REACHED',
  REVISION_NOT_REQUIRED: 'REVISION_NOT_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_READ_ONLY: 'PROJECT_READ_ONLY',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
} as const;

/** Accion de auditoria al registrar una nueva version revisada. */
export function proposalVersionUploadAuditAction(versionNumber: number): string {
  return `upload_proposal_version:v${versionNumber}`;
}
