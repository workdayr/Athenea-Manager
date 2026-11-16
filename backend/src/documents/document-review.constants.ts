/**
 * F1-11 / BR-003: revision administrativa de documentos.
 *
 * Solo el informe final (`results`) y la aprobacion de etica
 * (`ethics_approval`) requieren una decision explicita de la
 * administracion. El resto del expediente no se revisa por este flujo.
 */

import { PROJECT_ERROR_CODES } from '../projects/projects.constants.js';

export const REVIEWABLE_DOCUMENT_TYPES = [
  'results',
  'ethics_approval',
] as const;

export type ReviewableDocumentType =
  (typeof REVIEWABLE_DOCUMENT_TYPES)[number];

/** BR-003: decisiones de revision admitidas. */
export const REVIEW_DECISIONS = ['Approved', 'Rejected'] as const;

export type ReviewDecisionValue = (typeof REVIEW_DECISIONS)[number];

/** BR-003: roles que aprueban o rechazan documentos. */
export const DOCUMENT_REVIEWER_ROLES = [
  'ADMINISTRATOR',
  'COORDINATOR',
] as const;

/** Longitud maxima de las notas de revision. */
export const REVIEW_NOTES_MAX_LENGTH = 2000;

export const DOCUMENT_REVIEW_ERROR_CODES = {
  NOT_REVIEWABLE: 'DOCUMENT_NOT_REVIEWABLE',
  ...PROJECT_ERROR_CODES,
} as const;

/** RF-017: accion de auditoria de la revision documental. */
export function documentReviewAuditAction(
  docType: string,
  decision: string,
): string {
  return `review_project_document:${docType}:${decision}`;
}
