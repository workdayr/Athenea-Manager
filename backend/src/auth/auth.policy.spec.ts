import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_LOCKOUT_MINUTES,
  INSTITUTIONAL_EMAIL_DOMAIN,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants.js';
import {
  evaluateLockout,
  getAuthorizedEmailDomains,
  isAuthorizedEmail,
  isInstitutionalEmail,
  nextStateAfterFailure,
  nextStateAfterSuccess,
  parseAuthorizedDomains,
  unauthorizedDomainMessage,
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

describe('parseAuthorizedDomains / isAuthorizedEmail (RF-015)', () => {
  it('siempre incluye el dominio institucional', () => {
    expect(parseAuthorizedDomains('')).toContain(INSTITUTIONAL_EMAIL_DOMAIN);
    expect(parseAuthorizedDomains(undefined)).toContain(
      INSTITUTIONAL_EMAIL_DOMAIN,
    );
    expect(parseAuthorizedDomains('otro.edu.mx')).toEqual([
      '@otro.edu.mx',
      INSTITUTIONAL_EMAIL_DOMAIN,
    ]);
  });

  it('normaliza formato: @, espacios, mayusculas y duplicados', () => {
    expect(
      parseAuthorizedDomains(
        ' @Ejemplo.EDU.mx , ejemplo.edu.mx,,unipolidgo.edu.mx ',
      ),
    ).toEqual(['@ejemplo.edu.mx', INSTITUTIONAL_EMAIL_DOMAIN]);
  });

  it('isAuthorizedEmail acepta institucional y externos autorizados', () => {
    const domains = ['@socio.edu.mx', INSTITUTIONAL_EMAIL_DOMAIN];
    expect(isAuthorizedEmail('alumno@unipolidgo.edu.mx', domains)).toBe(true);
    expect(isAuthorizedEmail('externo@socio.edu.mx', domains)).toBe(true);
    expect(isAuthorizedEmail('Externo@SOCIO.EDU.MX ', domains)).toBe(true);
  });

  it('isAuthorizedEmail rechaza dominios no listados y suplantaciones', () => {
    const domains = ['@socio.edu.mx', INSTITUTIONAL_EMAIL_DOMAIN];
    expect(isAuthorizedEmail('alumno@gmail.com', domains)).toBe(false);
    expect(isAuthorizedEmail('alumno@unipolidgo.edu.mx.evil.com', domains)).toBe(
      false,
    );
    expect(isAuthorizedEmail('alumno@fakesocio.edu.mx', domains)).toBe(false);
    expect(isAuthorizedEmail(null, domains)).toBe(false);
  });

  it('getAuthorizedEmailDomains lee el entorno con default institucional', () => {
    const previous = process.env.AUTHORIZED_EMAIL_DOMAINS;
    try {
      delete process.env.AUTHORIZED_EMAIL_DOMAINS;
      expect(getAuthorizedEmailDomains()).toEqual([
        INSTITUTIONAL_EMAIL_DOMAIN,
      ]);
      process.env.AUTHORIZED_EMAIL_DOMAINS = 'socio.edu.mx';
      expect(getAuthorizedEmailDomains()).toEqual([
        '@socio.edu.mx',
        INSTITUTIONAL_EMAIL_DOMAIN,
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.AUTHORIZED_EMAIL_DOMAINS;
      } else {
        process.env.AUTHORIZED_EMAIL_DOMAINS = previous;
      }
    }
  });

  it('unauthorizedDomainMessage lista los dominios en espanol', () => {
    expect(
      unauthorizedDomainMessage(['@socio.edu.mx', INSTITUTIONAL_EMAIL_DOMAIN]),
    ).toBe(
      'Solo se aceptan correos de dominios autorizados: socio.edu.mx, unipolidgo.edu.mx',
    );
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
