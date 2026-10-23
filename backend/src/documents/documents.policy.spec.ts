import { describe, expect, it } from 'vitest';
import {
  canManageVisibility,
  isInstitutionalRole,
  isMandatoryReviewDocument,
  isSupportedVisibility,
  isVisibilityLocked,
  validateVisibilityChange,
} from './documents.policy.js';

describe('isMandatoryReviewDocument (US 4.1 / RF-005)', () => {
  it('marca protocolo y aprobacion de etica como obligatorios', () => {
    expect(isMandatoryReviewDocument('methodology')).toBe(true);
    expect(isMandatoryReviewDocument('ethics_approval')).toBe(true);
  });

  it('deja configurables los demas documentos y la evidencia', () => {
    for (const docType of [
      'hypothesis',
      'abstract',
      'rationale',
      'results',
      'evidence',
    ]) {
      expect(isMandatoryReviewDocument(docType)).toBe(false);
    }
  });
});

describe('isVisibilityLocked', () => {
  it('bloquea proyectos cerrados, completados o rechazados', () => {
    expect(isVisibilityLocked('Closed')).toBe(true);
    expect(isVisibilityLocked('Completed')).toBe(true);
    expect(isVisibilityLocked('Rejected')).toBe(true);
  });

  it('permite cambios en estados no terminales', () => {
    for (const status of ['Proposed', 'Under_Review', 'Approved', 'Active', 'Suspended']) {
      expect(isVisibilityLocked(status)).toBe(false);
    }
  });
});

describe('validateVisibilityChange', () => {
  it('acepta que un documento opcional quede solo para el equipo', () => {
    expect(
      validateVisibilityChange({
        docType: 'evidence',
        visibility: 'Team_only',
        projectStatus: 'Active',
      }),
    ).toBeNull();
  });

  it('acepta que un obligatorio se comparta con administracion', () => {
    expect(
      validateVisibilityChange({
        docType: 'methodology',
        visibility: 'Shared_with_administration',
        projectStatus: 'Active',
      }),
    ).toBeNull();
  });

  it('rechaza un obligatorio en Team_only con MANDATORY_DOCUMENT_VISIBILITY', () => {
    expect(
      validateVisibilityChange({
        docType: 'ethics_approval',
        visibility: 'Team_only',
        projectStatus: 'Active',
      }),
    ).toMatchObject({
      code: 'MANDATORY_DOCUMENT_VISIBILITY',
      httpStatus: 409,
    });
  });

  it('rechaza cualquier cambio en un proyecto terminal', () => {
    expect(
      validateVisibilityChange({
        docType: 'evidence',
        visibility: 'Shared_with_administration',
        projectStatus: 'Rejected',
      }),
    ).toMatchObject({
      code: 'PROJECT_STATE_IMMUTABLE',
      httpStatus: 409,
    });
  });

  it('rechaza visibilidades fuera del enum', () => {
    expect(
      validateVisibilityChange({
        docType: 'evidence',
        visibility: 'Public',
        projectStatus: 'Active',
      }),
    ).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('permisos', () => {
  it('solo el PI del proyecto gestiona la visibilidad', () => {
    expect(canManageVisibility('Principal_Investigator')).toBe(true);
    expect(canManageVisibility('Co_Investigator')).toBe(false);
    expect(canManageVisibility('Assistant')).toBe(false);
    expect(canManageVisibility(null)).toBe(false);
  });

  it('reconoce los roles institucionales', () => {
    expect(isInstitutionalRole('ADMINISTRATOR')).toBe(true);
    expect(isInstitutionalRole('COORDINATOR')).toBe(true);
    expect(isInstitutionalRole('COMMITTEE')).toBe(true);
    expect(isInstitutionalRole('PRINCIPAL_INVESTIGATOR')).toBe(false);
    expect(isInstitutionalRole('STUDENT')).toBe(false);
  });

  it('valida el enum de visibilidad', () => {
    expect(isSupportedVisibility('Team_only')).toBe(true);
    expect(isSupportedVisibility('Shared_with_administration')).toBe(true);
    expect(isSupportedVisibility('public')).toBe(false);
  });
});
