/**
 * Constantes del modulo proposal_evaluation (RF-019, BR-011, BR-004).
 * Los codigos viajan en `extensions.code` de GraphQL (§5.3.2 del
 * documento de arquitectura); `field` acompaña a errores de validacion.
 */

/** RF-019: justificacion (minuto de revision UC-003) acotada. */
export const JUSTIFICATION_MAX_LENGTH = 4000;

/** Estados de proyecto que admiten decision (UC-003, precondicion). */
export const EVALUABLE_STATUSES = ['Proposed', 'Under_Review'] as const;

/** Codigos de error GraphQL de este modulo. */
export const EVALUATION_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FAMILY_CONFLICT: 'FAMILY_CONFLICT',
  SELF_REVIEW: 'SELF_REVIEW',
  INVALID_STATE: 'INVALID_STATE',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
} as const;

/** Decisiones formales del comite (UC-003 paso 5). */
export const EVALUATION_DECISIONS = [
  'Approved',
  'Rejected',
  'Revision_Required',
] as const;

export type EvaluationDecisionValue =
  (typeof EVALUATION_DECISIONS)[number];

/** RF-003: estado resultante de cada decision. Revision_Required reusa
 * Under_Review (no se crea el estado Modification_Requested). */
export const STATUS_AFTER_DECISION: Record<
  EvaluationDecisionValue,
  string
> = {
  Approved: 'Approved',
  Rejected: 'Rejected',
  Revision_Required: 'Under_Review',
};

/** IP desconocida para Audit_Log.source_ip cuando no hay request. */
export const UNKNOWN_ACTOR_IP = 'unknown';

/** RF-003/RF-017: accion de auditoria de una decision. */
export function decisionAuditAction(from: string, to: string): string {
  return `submit_project_decision:${from}->${to}`;
}

/** BR-011: accion de auditoria al persistir una alerta de conflicto. */
export function conflictFlagAuditAction(): string {
  return 'flag_family_conflict';
}

/** BR-011: accion de auditoria al resolver una alerta de conflicto. */
export function conflictResolveAuditAction(
  conflictId: number,
  status: string,
): string {
  return `resolve_conflict_review:${conflictId}->${status}`;
}
