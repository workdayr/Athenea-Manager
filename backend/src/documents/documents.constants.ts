/**
 * US 4.1 / RF-005: configuracion de visibilidad documental.
 *
 * Reglas clave:
 * - Los documentos de revision obligatoria (protocolo y aprobacion del
 *   comite de etica) NUNCA pueden quedar como "Team_only": la
 *   administracion debe poder revisarlos.
 * - Una vez que el proyecto entra en un estado terminal (cerrado,
 *   completado o rechazado) la visibilidad queda congelada: ya fue
 *   revisado en su totalidad y el PI no debe alterar el expediente.
 */

import { PROJECT_ERROR_CODES } from '../projects/projects.constants.js';

/** Tipos documentales que exigen revision administrativa (RF-005). */
export const MANDATORY_REVIEW_DOCUMENT_TYPES = [
  'methodology',
  'ethics_approval',
] as const;

export type MandatoryReviewDocumentType =
  (typeof MANDATORY_REVIEW_DOCUMENT_TYPES)[number];

/** Estados de proyecto en los que la visibilidad ya no puede cambiar. */
export const LOCKED_PROJECT_STATUSES = [
  'Closed',
  'Completed',
  'Rejected',
] as const;

export type LockedProjectStatus = (typeof LOCKED_PROJECT_STATUSES)[number];

/** Valores validos del enum Visibility de Prisma. */
export const VISIBILITY_VALUES = [
  'Team_only',
  'Shared_with_administration',
] as const;

export type VisibilityValue = (typeof VISIBILITY_VALUES)[number];

/** Roles institucionales: solo ven documentos compartidos (RF-005). */
export const INSTITUTIONAL_ROLES = [
  'ADMINISTRATOR',
  'COORDINATOR',
  'COMMITTEE',
] as const;

/** Codigos de error propios de la configuracion de visibilidad. */
export const DOCUMENT_VISIBILITY_ERROR_CODES = {
  MANDATORY_DOCUMENT_VISIBILITY: 'MANDATORY_DOCUMENT_VISIBILITY',
  PROJECT_STATE_IMMUTABLE: 'PROJECT_STATE_IMMUTABLE',
  // Incluye PROJECT_READ_ONLY (RF-020) desde el catalogo de proyectos.
  ...PROJECT_ERROR_CODES,
} as const;

/** Accion de auditoria al cambiar la visibilidad (RF-017). */
export function visibilityChangeAuditAction(
  docType: string,
  visibility: string,
): string {
  return `set_document_visibility:${docType}:${visibility}`;
}
