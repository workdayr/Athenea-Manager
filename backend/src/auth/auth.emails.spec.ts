import { describe, expect, it } from 'vitest';
import {
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  resolveRequireEmailVerification,
} from './auth.config.js';
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  frontendOrigin,
  passwordResetUrl,
  verificationUrl,
} from './auth.emails.js';

describe('resolveRequireEmailVerification (F1-06)', () => {
  it('queda apagada fuera de produccion cuando no hay variable', () => {
    expect(resolveRequireEmailVerification({})).toBe(false);
    expect(
      resolveRequireEmailVerification({ NODE_ENV: 'development' }),
    ).toBe(false);
  });

  it('se activa en produccion o con la variable explicita', () => {
    expect(resolveRequireEmailVerification({ NODE_ENV: 'production' })).toBe(
      true,
    );
    expect(
      resolveRequireEmailVerification({ EMAIL_VERIFICATION_REQUIRED: 'true' }),
    ).toBe(true);
    expect(
      resolveRequireEmailVerification({
        NODE_ENV: 'production',
        EMAIL_VERIFICATION_REQUIRED: 'false',
      }),
    ).toBe(false);
  });
});

describe('plantillas de correo de autenticacion (F1-06)', () => {
  it('el enlace de recuperacion expira a los 30 minutos', () => {
    expect(PASSWORD_RESET_TOKEN_TTL_SECONDS).toBe(30 * 60);
  });

  it('construye enlaces contra el frontend sin doble barra', () => {
    expect(frontendOrigin({ FRONTEND_ORIGIN: 'https://athenea.test/' })).toBe(
      'https://athenea.test',
    );
    expect(verificationUrl('abc 123')).toBe(
      'http://localhost:3000/verify-email?token=abc%20123',
    );
    expect(passwordResetUrl('tok')).toBe(
      'http://localhost:3000/reset-password?token=tok',
    );
  });

  it('incluye nombre y enlace en ambos correos', () => {
    const verification = buildVerificationEmail(
      'Ana',
      'http://localhost:3000/verify-email?token=x',
    );
    expect(verification.subject).toMatch(/verifica/i);
    expect(verification.text).toContain('Hola Ana');
    expect(verification.text).toContain(
      'http://localhost:3000/verify-email?token=x',
    );

    const reset = buildPasswordResetEmail(
      'Luis',
      'http://localhost:3000/reset-password?token=y',
    );
    expect(reset.subject).toMatch(/contrasena/i);
    expect(reset.text).toContain('30 minutos');
  });
});
