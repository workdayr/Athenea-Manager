import { describe, expect, it } from 'vitest';
import {
  exceedsProjectQuota,
  hasReachedProjectLimit,
  isActiveProjectStatus,
  isRequiredDocumentType,
  remainingProjectSlots,
  validatePdfUpload,
  validateRegisterProjectInput,
} from './projects.policy.js';

const validInput = {
  title: 'Estudio Bioinformatico',
  objectives: 'Objetivo general y especificos.',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
};

describe('validateRegisterProjectInput (RF-002)', () => {
  it('acepta una entrada valida', () => {
    expect(validateRegisterProjectInput(validInput)).toEqual([]);
  });

  it('rechaza titulo vacio o mayor a 300 caracteres', () => {
    expect(
      validateRegisterProjectInput({ ...validInput, title: '  ' }),
    ).toHaveLength(1);
    expect(
      validateRegisterProjectInput({ ...validInput, title: 'x'.repeat(301) }),
    ).toHaveLength(1);
  });

  it('rechaza objetivos mayores a 2000 caracteres', () => {
    expect(
      validateRegisterProjectInput({
        ...validInput,
        objectives: 'x'.repeat(2001),
      }),
    ).toHaveLength(1);
  });

  it('rechaza fin anterior o igual al inicio', () => {
    expect(
      validateRegisterProjectInput({
        ...validInput,
        endDate: new Date('2025-01-01'),
      }),
    ).toHaveLength(1);
  });
});

describe('limite BR-002', () => {
  it('bloquea al llegar a 3 activos', () => {
    expect(hasReachedProjectLimit(2)).toBe(false);
    expect(hasReachedProjectLimit(3)).toBe(true);
    expect(remainingProjectSlots(2)).toBe(1);
  });

  it('Draft/Proposed/Under_Review/Approved/Active cuentan como activos', () => {
    expect(isActiveProjectStatus('Draft')).toBe(true);
    expect(isActiveProjectStatus('Proposed')).toBe(true);
    expect(isActiveProjectStatus('Active')).toBe(true);
    expect(isActiveProjectStatus('Closed')).toBe(false);
    expect(isActiveProjectStatus('Rejected')).toBe(false);
  });
});

describe('documentos (RF-002 / RF-016)', () => {
  it('solo acepta los 5 tipos obligatorios', () => {
    expect(isRequiredDocumentType('hypothesis')).toBe(true);
    expect(isRequiredDocumentType('ethics_approval')).toBe(false);
  });

  it('valida PDF por Magic Numbers y 25 MB', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(validatePdfUpload(pdf, 100)).toBeNull();
    expect(validatePdfUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 100)).not.toBeNull();
    expect(validatePdfUpload(pdf, 26 * 1024 * 1024)).not.toBeNull();
  });

  it('aplica la cuota de 500 MB por proyecto', () => {
    expect(exceedsProjectQuota(400 * 1024 * 1024, 200 * 1024 * 1024)).toBe(true);
    expect(exceedsProjectQuota(400 * 1024 * 1024, 50 * 1024 * 1024)).toBe(false);
  });
});
