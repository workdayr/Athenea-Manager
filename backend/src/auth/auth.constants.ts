/**
 * Reglas institucionales y de seguridad para autenticacion
 * (RF-010, BR-005, RF-015).
 *
 * - Solo se aceptan correos institucionales de la Universidad Politecnica
 *   de Durango, mas los dominios externos previamente autorizados
 *   (RF-015) via AUTHORIZED_EMAIL_DOMAINS.
 * - 5 intentos fallidos de login bloquean la cuenta por 15 minutos.
 * - Contrasenas de 8 a 64 caracteres, hasheadas con bcrypt cost 12.
 */
export const INSTITUTIONAL_EMAIL_DOMAIN = '@unipolidgo.edu.mx';

/**
 * Variable de entorno con la lista de dominios autorizados separados por
 * coma (sin @). Siempre incluye el dominio institucional.
 * Ej: AUTHORIZED_EMAIL_DOMAINS=unipolidgo.edu.mx,ejemplo.edu.mx
 */
export const AUTHORIZED_EMAIL_DOMAINS_ENV_VAR = 'AUTHORIZED_EMAIL_DOMAINS';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export const ACCOUNT_LOCKOUT_MINUTES = 15;

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 64;

export const BCRYPT_COST_FACTOR = 12;

/** Rol asignado por defecto al registrarse (RF-001: el usuario no elige rol). */
export const DEFAULT_USER_ROLE = 'STUDENT' as const;

/**
 * Codigo de error devuelto cuando el correo no pertenece a un dominio
 * autorizado (BR-005, RF-015). Viaja en `APIError.body.code` para que el
 * callback OAuth lo propague como `?error=` al frontend: BetterAuth solo
 * redirige el error del callback si el cuerpo trae `code` (si no, el
 * navegador recibe el JSON crudo). El frontend mapea este mismo string
 * en `auth-errors.ts`.
 */
export const UNAUTHORIZED_DOMAIN_ERROR_CODE = 'unauthorized_email_domain';
