/**
 * Constantes para productos de investigacion (RF-007, BR-009).
 */

export const PRODUCT_TYPES = [
  'journal_article',
  'conference_presentation',
  'software',
  'patent',
  'thesis',
] as const;

export type ProductTypeValue = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TITLE_MAX_LENGTH = 300;
export const PRODUCT_URL_DOI_MAX_LENGTH = 1000;

export const PRODUCT_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_URL_DOI: 'INVALID_URL_DOI',
  INVALID_PRODUCT_TYPE: 'INVALID_PRODUCT_TYPE',
  PROJECT_STATE_INVALID: 'PROJECT_STATE_INVALID',
  RESEARCH_OUTPUT_REQUIRED: 'RESEARCH_OUTPUT_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_READ_ONLY: 'PROJECT_READ_ONLY',
} as const;

/** Estados del proyecto que admiten registrar productos (Active o Completed). */
export const PRODUCT_ELIGIBLE_PROJECT_STATUSES = [
  'Active',
  'Completed',
] as const;

/** Accion de auditoria al registrar un producto de investigacion. */
export function productRegisterAuditAction(productType: string): string {
  return `register_research_output:${productType}`;
}
