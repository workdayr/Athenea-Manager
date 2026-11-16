/**
 * RF-014: constantes de notificaciones in-app y de la cola de correos.
 */

/** Paginacion de la bandeja personal. */
export const NOTIFICATIONS_PAGE_SIZE_DEFAULT = 20;
export const NOTIFICATIONS_PAGE_SIZE_MAX = 50;

/** Recorte defensivo de los campos persistidos. */
export const NOTIFICATION_TITLE_MAX_LENGTH = 200;
export const NOTIFICATION_LINK_MAX_LENGTH = 500;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 4000;

/** Outbox de correo: frecuencia del job y politica de reintentos. */
export const EMAIL_OUTBOX_INTERVAL_MS = 30_000;
export const EMAIL_OUTBOX_INITIAL_DELAY_MS = 10_000;
export const EMAIL_OUTBOX_BATCH_SIZE = 20;
export const EMAIL_OUTBOX_MAX_ATTEMPTS = 5;
export const EMAIL_OUTBOX_BACKOFF_BASE_MS = 60_000;
export const EMAIL_OUTBOX_BACKOFF_MAX_MS = 60 * 60 * 1000;

/** Codigos de error del modulo (se mapean a GraphQL). */
export const NOTIFICATION_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

function positiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

/** Permite acelerar el job en desarrollo/pruebas. */
export function resolveEmailOutboxIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1_000,
    positiveInteger(env['EMAIL_OUTBOX_INTERVAL_MS'], EMAIL_OUTBOX_INTERVAL_MS),
  );
}

export function resolveEmailOutboxMaxAttempts(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1,
    positiveInteger(
      env['EMAIL_OUTBOX_MAX_ATTEMPTS'],
      EMAIL_OUTBOX_MAX_ATTEMPTS,
    ),
  );
}

/** Backoff exponencial acotado a una hora. */
export function nextEmailAttemptAt(attempts: number, now: Date): Date {
  const exponent = Math.max(0, attempts - 1);
  const delay = Math.min(
    EMAIL_OUTBOX_BACKOFF_MAX_MS,
    EMAIL_OUTBOX_BACKOFF_BASE_MS * 2 ** exponent,
  );
  return new Date(now.getTime() + delay);
}
