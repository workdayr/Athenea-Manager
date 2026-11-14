import { ROLES } from '../auth/roles.constants.js';

/**
 * F1-02 / RF-003: maquina de estados del ciclo de vida del proyecto.
 */

export const PROJECT_STATUS_VALUES = [
  'Draft',
  'Proposed',
  'Under_Review',
  'Approved',
  'Active',
  'Completed',
  'Closed',
  'Rejected',
  'Suspended',
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number];

/** RF-019: justificacion de una transicion acotada. */
export const TRANSITION_JUSTIFICATION_MAX_LENGTH = 4000;

/** F1-02: un proyecto Under_Review > 30 dias genera alerta. */
export const REVIEW_SLA_DAYS_DEFAULT = 30;

export const REVIEW_SLA_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const REVIEW_SLA_INITIAL_DELAY_MS = 30_000;
export const REVIEW_SLA_BATCH_SIZE = 50;

export const LIFECYCLE_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  JUSTIFICATION_REQUIRED: 'JUSTIFICATION_REQUIRED',
  DECISION_REQUIRED: 'DECISION_REQUIRED',
  /** BR-006: falta la aprobacion de etica. */
  ETHICS_APPROVAL_REQUIRED: 'ETHICS_APPROVAL_REQUIRED',
  /** BR-003: el informe final no esta aprobado. */
  FINAL_REPORT_NOT_APPROVED: 'FINAL_REPORT_NOT_APPROVED',
} as const;

export interface TransitionRule {
  from: ProjectStatusValue;
  to: ProjectStatusValue;
  roles: readonly string[];
  requiresJustification?: boolean;
}

/**
 * Matriz validada con el equipo. Incluye las decisiones del comite tanto
 * desde Proposed (comportamiento vigente) como desde Under_Review.
 */
export const TRANSITION_RULES: readonly TransitionRule[] = [
  {
    from: 'Draft',
    to: 'Proposed',
    roles: [ROLES.PRINCIPAL_INVESTIGATOR],
  },
  {
    from: 'Proposed',
    to: 'Under_Review',
    roles: [
      ROLES.PRINCIPAL_INVESTIGATOR,
      ROLES.COORDINATOR,
      ROLES.COMMITTEE,
    ],
  },
  {
    from: 'Proposed',
    to: 'Approved',
    roles: [ROLES.COMMITTEE, ROLES.COORDINATOR],
  },
  {
    from: 'Proposed',
    to: 'Rejected',
    roles: [ROLES.COMMITTEE, ROLES.COORDINATOR],
  },
  {
    from: 'Under_Review',
    to: 'Approved',
    roles: [ROLES.COMMITTEE, ROLES.COORDINATOR],
  },
  {
    from: 'Under_Review',
    to: 'Rejected',
    roles: [ROLES.COMMITTEE, ROLES.COORDINATOR],
  },
  {
    from: 'Under_Review',
    to: 'Under_Review',
    roles: [ROLES.COMMITTEE, ROLES.COORDINATOR],
  },
  {
    from: 'Approved',
    to: 'Active',
    roles: [ROLES.COORDINATOR, ROLES.ADMINISTRATOR],
  },
  {
    from: 'Active',
    to: 'Completed',
    roles: [ROLES.PRINCIPAL_INVESTIGATOR],
  },
  {
    from: 'Active',
    to: 'Suspended',
    roles: [ROLES.COORDINATOR, ROLES.ADMINISTRATOR],
    requiresJustification: true,
  },
  {
    from: 'Suspended',
    to: 'Active',
    roles: [ROLES.COORDINATOR, ROLES.ADMINISTRATOR],
  },
  {
    from: 'Suspended',
    to: 'Closed',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    from: 'Completed',
    to: 'Closed',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    from: 'Rejected',
    to: 'Closed',
    roles: [ROLES.ADMINISTRATOR],
  },
] as const;

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

export function resolveSlaReviewDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1,
    positiveInteger(env['PROJECT_SLA_REVIEW_DAYS'], REVIEW_SLA_DAYS_DEFAULT),
  );
}

/** Permite acelerar el job en desarrollo/pruebas. */
export function resolveSlaIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    1_000,
    positiveInteger(env['PROJECT_SLA_INTERVAL_MS'], REVIEW_SLA_INTERVAL_MS),
  );
}
