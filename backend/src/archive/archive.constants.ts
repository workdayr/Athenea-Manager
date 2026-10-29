/**
 * RF-020: constantes del archivado institucional de proyectos cerrados.
 */

/** El SRS define un job diario de archivado. */
export const ARCHIVE_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Primera ejecucion tras el arranque: evita esperar 24 h para archivar
 * proyectos que ya estaban cerrados al desplegar.
 */
export const ARCHIVE_SCAN_INITIAL_DELAY_MS = 30_000;

/** Limite de proyectos procesados por ejecucion. */
export const ARCHIVE_BATCH_SIZE = 50;

/** Timeout de la transaccion ACID por proyecto (ms). */
export const ARCHIVE_TRANSACTION_TIMEOUT_MS = 15_000;

/** Recorte defensivo del mensaje persistido en la alerta. */
export const ARCHIVE_ALERT_MESSAGE_MAX_LENGTH = 4000;

/** Codigos de error del modulo. */
export const ARCHIVE_ERROR_CODES = {
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  NOT_CLOSED: 'NOT_CLOSED',
  ALREADY_ARCHIVED: 'ALREADY_ARCHIVED',
  ARCHIVE_FAILED: 'ARCHIVE_FAILED',
} as const;

/**
 * Permite acelerar el job en desarrollo/pruebas con
 * `PROJECT_ARCHIVE_INTERVAL_MS`. Sin la variable se usa el intervalo diario.
 */
export function resolveArchiveIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env['PROJECT_ARCHIVE_INTERVAL_MS'];
  if (!raw) {
    return ARCHIVE_SCAN_INTERVAL_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ARCHIVE_SCAN_INTERVAL_MS;
  }
  return Math.max(1_000, Math.trunc(parsed));
}
