/**
 * F1-11 / BR-006, BR-012, BR-013: constantes de etica y retencion.
 */

/** BR-013: periodo de retencion por defecto (5 anos). */
export const RETENTION_YEARS_DEFAULT = 5;

/** BR-013: aviso al PI con 30 dias de anticipacion. */
export const RETENTION_NOTICE_DAYS_DEFAULT = 30;

/** Job diario de avisos y borrado seguro. */
export const RETENTION_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const RETENTION_SCAN_INITIAL_DELAY_MS = 30_000;
export const RETENTION_BATCH_SIZE = 20;

/** Timeout de la transaccion de borrado por proyecto. */
export const RETENTION_TRANSACTION_TIMEOUT_MS = 30_000;

/** BR-012: formatos de dataset que exigen certificacion (CSV no soportado). */
export const DATASET_EXTENSIONS = ['xlsx'] as const;

export const ETHICS_ERROR_CODES = {
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  ANONYMIZATION_CERTIFICATION_REQUIRED: 'ANONYMIZATION_CERTIFICATION_REQUIRED',
  ETHICS_APPROVAL_REQUIRED: 'ETHICS_APPROVAL_REQUIRED',
  FINAL_REPORT_NOT_APPROVED: 'FINAL_REPORT_NOT_APPROVED',
  RETENTION_FAILED: 'RETENTION_FAILED',
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

export function resolveRetentionYears(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1,
    positiveInteger(env['PROJECT_RETENTION_YEARS'], RETENTION_YEARS_DEFAULT),
  );
}

export function resolveRetentionNoticeDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1,
    positiveInteger(
      env['PROJECT_RETENTION_NOTICE_DAYS'],
      RETENTION_NOTICE_DAYS_DEFAULT,
    ),
  );
}

/** Permite acelerar el job en desarrollo/pruebas. */
export function resolveRetentionIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1_000,
    positiveInteger(
      env['PROJECT_RETENTION_INTERVAL_MS'],
      RETENTION_SCAN_INTERVAL_MS,
    ),
  );
}
