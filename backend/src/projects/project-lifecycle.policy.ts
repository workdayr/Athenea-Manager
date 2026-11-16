import {
  PROJECT_STATUS_VALUES,
  TRANSITION_JUSTIFICATION_MAX_LENGTH,
  TRANSITION_RULES,
  type ProjectStatusValue,
  type TransitionRule,
} from './project-lifecycle.constants.js';

/**
 * Reglas puras de la maquina de estados (F1-02 / RF-003). Sin E/S.
 */

export function isProjectStatus(value: unknown): value is ProjectStatusValue {
  return (PROJECT_STATUS_VALUES as readonly string[]).includes(value as string);
}

export function findTransitionRule(
  from: string,
  to: string,
): TransitionRule | null {
  return (
    TRANSITION_RULES.find(
      (rule) => rule.from === from && rule.to === to,
    ) ?? null
  );
}

export function isTransitionAllowed(from: string, to: string): boolean {
  return findTransitionRule(from, to) !== null;
}

export function canRoleTransition(
  role: string,
  from: string,
  to: string,
): boolean {
  const rule = findTransitionRule(from, to);
  return rule !== null && rule.roles.includes(role);
}

export function requiresJustification(from: string, to: string): boolean {
  return findTransitionRule(from, to)?.requiresJustification === true;
}

/** Devuelve el mensaje de error o `null` si la justificacion es valida. */
export function validateJustification(
  value: unknown,
  required: boolean,
): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && text.length === 0) {
    return 'La justificacion es obligatoria para esta transicion.';
  }
  if (text.length > TRANSITION_JUSTIFICATION_MAX_LENGTH) {
    return `La justificacion excede ${TRANSITION_JUSTIFICATION_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/** F1-02: un proyecto Under_Review supera el SLA de revision. */
export function isReviewSlaOverdue(
  status: string,
  statusChangedAt: Date,
  now: Date,
  days: number,
): boolean {
  if (status !== 'Under_Review') {
    return false;
  }
  const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;
  return statusChangedAt.getTime() <= threshold;
}
