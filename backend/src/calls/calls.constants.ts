/** US 2.2 / RF-018: reglas de publicacion y cierre de convocatorias. */

export const CALL_TITLE_MAX_LENGTH = 200;

/** Intervalo del job que cierra convocatorias vencidas (1 minuto). */
export const CALL_AUTO_CLOSE_INTERVAL_MS = 60_000;

/** Codigos de error GraphQL de este modulo. */
export const CALL_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  CALL_CLOSED: 'CALL_CLOSED',
  CALL_FULL: 'CALL_FULL',
} as const;
