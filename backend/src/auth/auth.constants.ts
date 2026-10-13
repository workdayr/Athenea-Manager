/**
 * Reglas institucionales y de seguridad para autenticacion (RF-010, BR-005).
 *
 * - Solo se aceptan correos institucionales de la Universidad Politecnica
 *   de Durango.
 * - 5 intentos fallidos de login bloquean la cuenta por 15 minutos.
 * - Contrasenas de 8 a 64 caracteres, hasheadas con bcrypt cost 12.
 */
export const INSTITUTIONAL_EMAIL_DOMAIN = '@unipolidgo.edu.mx';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export const ACCOUNT_LOCKOUT_MINUTES = 15;

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 64;

export const BCRYPT_COST_FACTOR = 12;

/** Rol asignado por defecto al registrarse (RF-001: el usuario no elige rol). */
export const DEFAULT_USER_ROLE = 'STUDENT' as const;
