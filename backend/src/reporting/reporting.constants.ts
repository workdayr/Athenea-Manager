/**
 * RF-008 / UC-009: dashboard institucional de coordinacion y administracion.
 */

/** RF-008: la cache del tablero nunca debe superar los 15 minutos. */
export const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000;

/** RF-013: paginacion maxima de 50 registros por pagina. */
export const REPORT_PAGE_SIZE_DEFAULT = 10;
export const REPORT_PAGE_SIZE_MAX = 50;

/** RF-006: un hito vencido se marca en riesgo al septimo dia de retraso. */
export const DELAY_THRESHOLD_DAYS = 7;

/** Limite defensivo para busquedas y cache en memoria. */
export const REPORT_SEARCH_MAX_LENGTH = 100;
export const REPORT_CACHE_MAX_ENTRIES = 100;

/** Orden estable de estados para el embudo y la tabla de distribucion. */
export const PROJECT_STATUS_VALUES = [
  'Draft',
  'Proposed',
  'Under_Review',
  'Approved',
  'Active',
  'Suspended',
  'Completed',
  'Closed',
  'Rejected',
] as const;

export type ReportingProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

/** Codigos de error GraphQL del modulo. */
export const REPORT_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REPORTING_UNAVAILABLE: 'REPORTING_UNAVAILABLE',
} as const;
