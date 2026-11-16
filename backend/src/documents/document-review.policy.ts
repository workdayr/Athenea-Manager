import {
  DOCUMENT_REVIEWER_ROLES,
  REVIEWABLE_DOCUMENT_TYPES,
  REVIEW_DECISIONS,
  REVIEW_NOTES_MAX_LENGTH,
  type ReviewDecisionValue,
} from './document-review.constants.js';

/**
 * Reglas puras de la revision documental (F1-11 / BR-003). Sin E/S.
 */

export function isReviewableDocument(docType: string): boolean {
  return (REVIEWABLE_DOCUMENT_TYPES as readonly string[]).includes(docType);
}

export function isReviewerRole(role: string): boolean {
  return (DOCUMENT_REVIEWER_ROLES as readonly string[]).includes(role);
}

export function isReviewDecision(value: unknown): value is ReviewDecisionValue {
  return (REVIEW_DECISIONS as readonly string[]).includes(value as string);
}

/** Devuelve el mensaje de error o `null` si las notas son validas. */
export function validateReviewNotes(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return 'Las notas de revision no son validas.';
  }
  if (value.trim().length > REVIEW_NOTES_MAX_LENGTH) {
    return `Las notas de revision exceden ${REVIEW_NOTES_MAX_LENGTH} caracteres.`;
  }
  return null;
}
