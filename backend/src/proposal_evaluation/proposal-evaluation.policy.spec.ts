import { describe, expect, it } from 'vitest';
import { JUSTIFICATION_MAX_LENGTH } from './proposal-evaluation.constants.js';
import {
  canEvaluateStatus,
  detectFamilyConflict,
  extractSurnames,
  isSelfReview,
  normalizePersonName,
  statusAfterDecision,
  validateJustification,
} from './proposal-evaluation.policy.js';

describe('normalizePersonName', () => {
  it('normaliza mayusculas, acentos y espacios', () => {
    expect(normalizePersonName('  José María ÁLVAREZ-Vargas  ')).toBe(
      'jose maria alvarez vargas',
    );
  });

  it('colapsa signos y deja solo letras', () => {
    expect(normalizePersonName("O'Brien (Jr.)")).toBe('o brien jr');
  });
});

describe('extractSurnames', () => {
  it('mononimo devuelve el unico token', () => {
    expect(extractSurnames('Platon')).toEqual(['platon']);
  });

  it('"Nombre Apellido" devuelve solo el apellido', () => {
    expect(extractSurnames('Juan Perez')).toEqual(['perez']);
  });

  it('nombre completo devuelve los ultimos dos tokens', () => {
    expect(extractSurnames('Maria Elena Vargas Lopez')).toEqual([
      'vargas',
      'lopez',
    ]);
  });

  it('ignora conjunciones de una letra', () => {
    expect(extractSurnames('Jose Perez y Lopez')).toEqual([
      'perez',
      'lopez',
    ]);
  });
});

describe('detectFamilyConflict (BR-011)', () => {
  it('detecta coincidencia exacta de apellido', () => {
    expect(
      detectFamilyConflict('Elena Vargas Lopez', [
        'Carlos Arellano Hernandez',
        'Maria Vargas Torres',
      ]),
    ).toEqual(['vargas']);
  });

  it('es insensible a mayusculas y acentos', () => {
    expect(detectFamilyConflict('ELENA VARGAS', ['elena vargas'])).toEqual([
      'vargas',
    ]);
    expect(detectFamilyConflict('Jose Alvarez', ['Maria Álvarez Torres'])).toEqual(
      ['alvarez',
    ]);
  });

  it('sin coincidencia devuelve vacio', () => {
    expect(
      detectFamilyConflict('Elena Vargas', ['Carlos Arellano', 'Luis Torres']),
    ).toEqual([]);
  });

  it('la coincidencia parcial (subcadena) NO alerta', () => {
    expect(detectFamilyConflict('Ana Vargas', ['Pedro Vargasllosa'])).toEqual(
      [],
    );
  });

  it('evaluador sin apellidos no genera falsos positivos', () => {
    expect(detectFamilyConflict('  ', ['Maria Vargas'])).toEqual([]);
  });
});

describe('isSelfReview (BR-004 parcial)', () => {
  it('detecta al evaluador dentro del equipo', () => {
    expect(isSelfReview('u1', ['u2', 'u1'])).toBe(true);
    expect(isSelfReview('u1', ['u2', 'u3'])).toBe(false);
  });
});

describe('canEvaluateStatus (UC-003)', () => {
  it('solo Proposed y Under_Review admiten decision', () => {
    expect(canEvaluateStatus('Proposed')).toBe(true);
    expect(canEvaluateStatus('Under_Review')).toBe(true);
    expect(canEvaluateStatus('Approved')).toBe(false);
    expect(canEvaluateStatus('Rejected')).toBe(false);
    expect(canEvaluateStatus('Active')).toBe(false);
  });
});

describe('statusAfterDecision (RF-003)', () => {
  it('mapea cada decision a su estado', () => {
    expect(statusAfterDecision('Approved')).toBe('Approved');
    expect(statusAfterDecision('Rejected')).toBe('Rejected');
    // Decision del dueno: Revision_Required reusa Under_Review.
    expect(statusAfterDecision('Revision_Required')).toBe('Under_Review');
  });
});

describe('validateJustification (RF-019)', () => {
  it('acepta una justificacion valida', () => {
    expect(validateJustification('Dictamen fundado del comite.')).toBeNull();
  });

  it('rechaza vacias o solo espacios', () => {
    expect(validateJustification('')).not.toBeNull();
    expect(validateJustification('   ')).not.toBeNull();
    expect(validateJustification(null)).not.toBeNull();
  });

  it('rechaza mas de 4000 caracteres', () => {
    expect(
      validateJustification('x'.repeat(JUSTIFICATION_MAX_LENGTH + 1)),
    ).not.toBeNull();
    expect(
      validateJustification('x'.repeat(JUSTIFICATION_MAX_LENGTH)),
    ).toBeNull();
  });
});
