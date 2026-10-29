/**
 * Reglas de registro de proyectos (US 2.1 / RF-002, RF-016, RNF-005,
 * BR-001, BR-002).
 */

/** RF-002: titulo oficial del proyecto. */
export const PROJECT_TITLE_MAX_LENGTH = 300;

/** RF-002: objetivos generales, especificos y justificacion. */
export const PROJECT_OBJECTIVES_MAX_LENGTH = 2000;

/** RF-002: documentos minimos obligatorios (uno por tipo). */
export const REQUIRED_DOCUMENT_TYPES = [
  'hypothesis',
  'abstract',
  'methodology',
  'rationale',
  'results',
] as const;

export type RequiredDocumentType = (typeof REQUIRED_DOCUMENT_TYPES)[number];

/** RF-016 / RNF-005: maximo por archivo. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** RNF-005: cuota total por proyecto. */
export const PROJECT_QUOTA_BYTES = 500 * 1024 * 1024;

/** BR-002: tope de proyectos activos por PI (salvo exencion documentada). */
export const MAX_ACTIVE_PROJECTS_PER_PI = 3;

/**
 * Estados que cuentan como "activo" para BR-002. Cerrados, rechazados o
 * completados liberan cupo.
 */
export const ACTIVE_PROJECT_STATUSES = [
  'Proposed',
  'Under_Review',
  'Approved',
  'Active',
] as const;

/** Firma magica de un PDF real (%PDF-). RF-016: validacion por Magic Numbers. */
export const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

/** Codigos de error GraphQL/REST de este modulo. */
export const PROJECT_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PI_LIMIT_EXCEEDED: 'PI_LIMIT_EXCEEDED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  /** RF-020: el proyecto esta archivado y no admite escrituras. */
  PROJECT_READ_ONLY: 'PROJECT_READ_ONLY',
} as const;
