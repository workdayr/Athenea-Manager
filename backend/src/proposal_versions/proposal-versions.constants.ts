/**
 * Constantes para versiones de propuestas de proyectos (US 3.2).
 *
 * El historial conserva la propuesta inicial (version 1) y las correcciones
 * posteriores. El maximo es de 5 versiones completas por proyecto.
 */

/** Maximo de versiones completas retenidas por proyecto (incluye la inicial). */
export const MAX_PROPOSAL_VERSIONS = 5;

export const PROPOSAL_COMMENT_MAX_LENGTH = 4000;

/**
 * Tipos documentales que forman parte de una propuesta revisada. La evidencia
 * de trabajo y la aprobacion de etica no se versionan por esta via.
 */
export const PROPOSAL_DOCUMENT_TYPES = [
  'hypothesis',
  'abstract',
  'methodology',
  'rationale',
  'results',
] as const;

export type ProposalDocumentType = (typeof PROPOSAL_DOCUMENT_TYPES)[number];

export const PROPOSAL_VERSION_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERSION_LIMIT_REACHED: 'VERSION_LIMIT_REACHED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  REVISION_NOT_REQUIRED: 'REVISION_NOT_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_READ_ONLY: 'PROJECT_READ_ONLY',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  MALWARE_DETECTED: 'MALWARE_DETECTED',
  SCAN_UNAVAILABLE: 'SCAN_UNAVAILABLE',
} as const;

/** Accion de auditoria al registrar una nueva version revisada. */
export function proposalVersionUploadAuditAction(versionNumber: number): string {
  return `upload_proposal_version:v${versionNumber}`;
}
