import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_LOCKOUT_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants.js';
import {
  evaluateLockout,
  isInstitutionalEmail,
  nextStateAfterFailure,
  nextStateAfterSuccess,
} from './auth.policy.js';

describe('isInstitutionalEmail (BR-005, scope UNIPOLI Durango)', () => {
  it('acepta correos @unipolidgo.edu.mx', () => {
    expect(isInstitutionalEmail('alumno@unipolidgo.edu.mx')).toBe(true);
    expect(isInstitutionalEmail('juan.perez@unipolidgo.edu.mx')).toBe(true);
  });

  it('es insensible a mayusculas y espacios', () => {
    expect(isInstitutionalEmail('Alumno@UNIPOLIDGO.EDU.MX')).toBe(true);
    expect(isInstitutionalEmail('  alumno@unipolidgo.edu.mx  ')).toBe(true);
  });

  it('rechaza dominios externos', () => {
    expect(isInstitutionalEmail('alumno@gmail.com')).toBe(false);
    expect(isInstitutionalEmail('alumno@outlook.com')).toBe(false);
    expect(isInstitutionalEmail('alumno@unipoli.edu.mx')).toBe(false);
    expect(isInstitutionalEmail('alumno@unipolidgo.edu.com')).toBe(false);
  });

  it('rechaza suplantaciones por sufijo', () => {
    expect(isInstitutionalEmail('alumno@unipolidgo.edu.mx.evil.com')).toBe(
      false,
    );
    expect(isInstitutionalEmail('alumno@fakeunipolidgo.edu.mx')).toBe(false);
  });

  it('rechaza valores no validos', () => {
    expect(isInstitutionalEmail('')).toBe(false);
    expect(isInstitutionalEmail('no-es-un-correo')).toBe(false);
    expect(isInstitutionalEmail(null)).toBe(false);
    expect(isInstitutionalEmail(undefined)).toBe(false);
    expect(isInstitutionalEmail(123)).toBe(false);
  });
});

describe('evaluateLockout (RF-010)', () => {
  const now = new Date('2026-10-13T12:00:00Z');

  it('no bloquea una cuenta sin intentos', () => {
    expect(
      evaluateLockout({ failedAttempts: 0, lockedUntil: null }, now),
    ).toEqual({ locked: false, lockedUntil: null });
  });

  it('bloquea mientras lockedUntil esta en el futuro', () => {
    const lockedUntil = new Date('2026-10-13T12:10:00Z');
    expect(
      evaluateLockout({ failedAttempts: 5, lockedUntil }, now),
    ).toEqual({ locked: true, lockedUntil });
  });

  it('no bloquea cuando el bloqueo ya expiro', () => {
    expect(
      evaluateLockout(
        { failedAttempts: 5, lockedUntil: new Date('2026-10-13T11:59:59Z') },
        now,
      ),
    ).toEqual({ locked: false, lockedUntil: null });
  });

  it('tolera lockedUntil ausente o invalido', () => {
    expect(
      evaluateLockout({ failedAttempts: 5, lockedUntil: undefined }, now),
    ).toEqual({ locked: false, lockedUntil: null });
    expect(
      evaluateLockout(
        { failedAttempts: 5, lockedUntil: 'fecha-invalida' },
        now,
      ),
    ).toEqual({ locked: false, lockedUntil: null });
  });
});

describe('nextStateAfterFailure / nextStateAfterSuccess', () => {
  const now = new Date('2026-10-13T12:00:00Z');

  it('incrementa el contador sin bloquear antes del limite', () => {
    expect(nextStateAfterFailure({ failedAttempts: 0 }, now)).toEqual({
      failedAttempts: 1,
      lockedUntil: null,
    });
    expect(
      nextStateAfterFailure(
        { failedAttempts: MAX_FAILED_LOGIN_ATTEMPTS - 2 },
        now,
      ),
    ).toEqual({
      failedAttempts: MAX_FAILED_LOGIN_ATTEMPTS - 1,
      lockedUntil: null,
    });
  });

  it(`bloquea por ${ACCOUNT_LOCKOUT_MINUTES} minutos al llegar a ${MAX_FAILED_LOGIN_ATTEMPTS} fallos`, () => {
    const update = nextStateAfterFailure(
      { failedAttempts: MAX_FAILED_LOGIN_ATTEMPTS - 1 },
      now,
    );
    expect(update.failedAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
    expect(update.lockedUntil).toBeInstanceOf(Date);
    expect(update.lockedUntil?.getTime()).toBe(
      now.getTime() + ACCOUNT_LOCKOUT_MINUTES * 60 * 1000,
    );
  });

  it('el login exitoso resetea el contador', () => {
    expect(nextStateAfterSuccess()).toEqual({
      failedAttempts: 0,
      lockedUntil: null,
    });
  });
});
