/**
 * Reglas puras de visibilidad documental (US 4.1 / RF-005). Sin E/S:
 * el servicio solo orquesta Prisma y auditoria.
 */

import { PROJECT_ERROR_CODES } from '../projects/projects.constants.js';
import {
  DOCUMENT_VISIBILITY_ERROR_CODES,
  INSTITUTIONAL_ROLES,
  LOCKED_PROJECT_STATUSES,
  MANDATORY_REVIEW_DOCUMENT_TYPES,
  VISIBILITY_VALUES,
  type VisibilityValue,
} from './documents.constants.js';

export interface VisibilityValidationIssue {
  code: string;
  message: string;
  httpStatus: number;
  field?: string;
}

/** El valor entrante es un valor valido del enum Visibility. */
export function isSupportedVisibility(
  value: unknown,
): value is VisibilityValue {
  return (VISIBILITY_VALUES as readonly string[]).includes(value as string);
}

/** El tipo documental exige revision administrativa (protocolo / etica). */
export function isMandatoryReviewDocument(docType: string): boolean {
  return (MANDATORY_REVIEW_DOCUMENT_TYPES as readonly string[]).includes(
    docType,
  );
}

/** El proyecto ya fue revisado/cerrado y no admite cambios de visibilidad. */
export function isVisibilityLocked(projectStatus: string): boolean {
  return (LOCKED_PROJECT_STATUSES as readonly string[]).includes(projectStatus);
}

/** Solo el Investigador Principal del proyecto configura la visibilidad. */
export function canManageVisibility(projectRole: string | null): boolean {
  return projectRole === 'Principal_Investigator';
}

/** Administrador, coordinador y comite solo acceden a lo compartido. */
export function isInstitutionalRole(role: string): boolean {
  return (INSTITUTIONAL_ROLES as readonly string[]).includes(role);
}

/**
 * Valida un cambio de visibilidad contra las reglas de negocio.
 * Devuelve null cuando el cambio es permitido.
 */
export function validateVisibilityChange(input: {
  docType: string;
  visibility: string;
  projectStatus: string;
}): VisibilityValidationIssue | null {
  if (!isSupportedVisibility(input.visibility)) {
    return {
      code: PROJECT_ERROR_CODES.VALIDATION_ERROR,
      message:
        'Visibilidad invalida. Valores permitidos: Team_only, Shared_with_administration.',
      httpStatus: 400,
      field: 'visibility',
    };
  }

  if (isVisibilityLocked(input.projectStatus)) {
    return {
      code: DOCUMENT_VISIBILITY_ERROR_CODES.PROJECT_STATE_IMMUTABLE,
      message:
        'El proyecto ya fue cerrado, completado o rechazado; su visibilidad no puede modificarse.',
      httpStatus: 409,
      field: 'visibility',
    };
  }

  if (
    isMandatoryReviewDocument(input.docType) &&
    input.visibility === 'Team_only'
  ) {
    return {
      code: DOCUMENT_VISIBILITY_ERROR_CODES.MANDATORY_DOCUMENT_VISIBILITY,
      message:
        'Los documentos de revision obligatoria (protocolo y aprobacion de etica) no pueden marcarse como Solo equipo.',
      httpStatus: 409,
      field: 'visibility',
    };
  }

  return null;
}
