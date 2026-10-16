import { describe, expect, it } from 'vitest';
import {
  closeReason,
  isCallOpen,
  remainingCallSlots,
  validateCreateCallInput,
} from './calls.policy.js';

const NOW = new Date('2026-06-01T12:00:00Z');
const FUTURE = new Date('2026-12-31T23:59:59Z');

const validInput = {
  title: 'Convocatoria 2026',
  description: 'Terminos y requisitos.',
  deadline: FUTURE,
  applicationCap: 10,
};

describe('validateCreateCallInput (US 2.2)', () => {
  it('acepta una convocatoria valida', () => {
    expect(validateCreateCallInput(validInput, NOW)).toEqual([]);
  });

  it('rechaza titulo vacio o mayor a 200 caracteres', () => {
    expect(
      validateCreateCallInput({ ...validInput, title: '  ' }, NOW),
    ).toHaveLength(1);
    expect(
      validateCreateCallInput({ ...validInput, title: 'x'.repeat(201) }, NOW),
    ).toHaveLength(1);
  });

  it('rechaza deadline pasado o invalido', () => {
    expect(
      validateCreateCallInput(
        { ...validInput, deadline: new Date('2026-01-01') },
        NOW,
      ),
    ).toHaveLength(1);
    expect(
      validateCreateCallInput({ ...validInput, deadline: 'no-fecha' }, NOW),
    ).toHaveLength(1);
  });

  it('rechaza cupo menor a 1 o no entero', () => {
    expect(
      validateCreateCallInput({ ...validInput, applicationCap: 0 }, NOW),
    ).toHaveLength(1);
    expect(
      validateCreateCallInput({ ...validInput, applicationCap: 2.5 }, NOW),
    ).toHaveLength(1);
  });
});

describe('cierre automatico (RF-018)', () => {
  const base = {
    status: 'OPEN',
    deadline: FUTURE,
    application_cap: 5,
    application_count: 2,
  };

  it('abierta con cupo y deadline futuro', () => {
    expect(isCallOpen(base, NOW)).toBe(true);
    expect(closeReason(base, NOW)).toBeNull();
    expect(remainingCallSlots(base)).toBe(3);
  });

  it('cierra por deadline aunque tenga cupo', () => {
    const expired = { ...base, deadline: new Date('2026-01-01') };
    expect(isCallOpen(expired, NOW)).toBe(false);
    expect(closeReason(expired, NOW)).toBe('EXPIRED');
  });

  it('cierra por cupo aunque el deadline sea futuro', () => {
    const full = { ...base, application_count: 5 };
    expect(isCallOpen(full, NOW)).toBe(false);
    expect(closeReason(full, NOW)).toBe('FULL');
    expect(remainingCallSlots(full)).toBe(0);
  });

  it('DRAFT nunca esta abierta', () => {
    expect(isCallOpen({ ...base, status: 'DRAFT' }, NOW)).toBe(false);
  });
});
