/**
 * F1-10 / RF-019: generacion asincrona del dictamen en PDF.
 */

/** Carpeta dentro de UPLOAD_DIR donde se guardan los dictamenes. */
export const DECISION_REPORT_DIR_NAME = 'decision-reports';

/** Frecuencia del worker in-process y retraso inicial. */
export const DECISION_REPORT_INTERVAL_MS = 15_000;
export const DECISION_REPORT_INITIAL_DELAY_MS = 5_000;

/** Tamano de lote y reintentos antes de marcar `Failed` definitivo. */
export const DECISION_REPORT_BATCH_SIZE = 5;
export const DECISION_REPORT_MAX_ATTEMPTS = 3;

/** Codigos de error GraphQL/REST del modulo. */
export const DECISION_REPORT_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  NOT_READY: 'REPORT_NOT_READY',
} as const;

/** Etiquetas en espanol del dictamen. */
export const DECISION_REPORT_LABELS: Record<string, string> = {
  Approved: 'Aprobado',
  Rejected: 'Rechazado',
  Revision_Required: 'Revisión requerida',
};

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

/** Permite acelerar el worker en desarrollo y pruebas. */
export function resolveDecisionReportIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1_000,
    positiveInteger(
      env['DECISION_REPORT_INTERVAL_MS'],
      DECISION_REPORT_INTERVAL_MS,
    ),
  );
}

export function resolveDecisionReportMaxAttempts(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1,
    positiveInteger(
      env['DECISION_REPORT_MAX_ATTEMPTS'],
      DECISION_REPORT_MAX_ATTEMPTS,
    ),
  );
}
