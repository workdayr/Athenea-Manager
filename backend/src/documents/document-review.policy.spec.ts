import { describe, expect, it } from 'vitest';
import { ROLES } from '../auth/roles.constants.js';
import {
  isReviewableDocument,
  isReviewDecision,
  isReviewerRole,
  validateReviewNotes,
} from './document-review.policy.js';

describe('document-review.policy (F1-11 / BR-003)', () => {
  it('solo el informe final y la aprobacion de etica son revisables', () => {
    expect(isReviewableDocument('results')).toBe(true);
    expect(isReviewableDocument('ethics_approval')).toBe(true);
    expect(isReviewableDocument('methodology')).toBe(false);
    expect(isReviewableDocument('evidence')).toBe(false);
  });

  it('revisan Administracion y Coordinacion', () => {
    expect(isReviewerRole(ROLES.ADMINISTRATOR)).toBe(true);
    expect(isReviewerRole(ROLES.COORDINATOR)).toBe(true);
    expect(isReviewerRole(ROLES.COMMITTEE)).toBe(false);
    expect(isReviewerRole(ROLES.PRINCIPAL_INVESTIGATOR)).toBe(false);
  });

  it('solo acepta Approved o Rejected como decision', () => {
    expect(isReviewDecision('Approved')).toBe(true);
    expect(isReviewDecision('Rejected')).toBe(true);
    expect(isReviewDecision('Pending')).toBe(false);
  });

  it('acota las notas de revision', () => {
    expect(validateReviewNotes(undefined)).toBeNull();
    expect(validateReviewNotes('')).toBeNull();
    expect(validateReviewNotes('Falta la firma del comite.')).toBeNull();
    expect(validateReviewNotes('x'.repeat(2001))).not.toBeNull();
  });
});
