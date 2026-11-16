import {
  EVALUABLE_STATUSES,
  JUSTIFICATION_MAX_LENGTH,
  STATUS_AFTER_DECISION,
  type EvaluationDecisionValue,
} from './proposal-evaluation.constants.js';

/**
 * Reglas puras del modulo proposal_evaluation (RF-019, RF-003, BR-011,
 * BR-004). Sin E/S: toda la logica testeable vive aqui; el servicio
 * solo orquesta Prisma y el resolver solo expone GraphQL.
 */

/** Minusculas, sin acentos ni signos, espacios colapsados. */
export function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .join(' ');
}

/**
 * Apellidos probables de un nombre completo en español:
 * - 1 token  -> el token (mononimo).
 * - 2 tokens -> solo el ultimo ("Nombre Apellido").
 * - 3+       -> los ultimos dos (puede incluir un segundo nombre;
 *               sesgo deliberado a la cautela: BR-011 prefiere alertar).
 * Se ignoran tokens de 1 letra (conjunciones como "y").
 */
export function extractSurnames(fullName: string): string[] {
  const tokens = normalizePersonName(fullName)
    .split(' ')
    .filter((token) => token.length > 1);
  if (tokens.length <= 1) {
    return tokens;
  }
  if (tokens.length === 2) {
    return [tokens[1]];
  }
  return tokens.slice(-2);
}

/**
 * BR-011: coincidencia EXACTA de apellidos entre el evaluador y el equipo.
 * Devuelve los apellidos coincidentes (vacio = sin conflicto). La
 * comparacion es insensible a mayusculas y acentos.
 */
export function detectFamilyConflict(
  evaluatorName: string,
  teamNames: string[],
): string[] {
  const mine = new Set(extractSurnames(evaluatorName));
  if (mine.size === 0) {
    return [];
  }
  const matched = new Set<string>();
  for (const name of teamNames) {
    for (const surname of extractSurnames(name)) {
      if (mine.has(surname)) {
        matched.add(surname);
      }
    }
  }
  return [...matched];
}

/**
 * F1-10 / BR-004: normaliza el departamento academico para compararlo
 * (sin acentos, mayusculas ni espacios repetidos). Vacio = sin dato.
 */
export function normalizeDepartment(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .join(' ');
  return normalized.length > 0 ? normalized : null;
}

/**
 * BR-004: evaluador y PI pertenecen al mismo departamento. Solo bloquea
 * cuando AMBOS departamentos estan declarados (D-02 pendiente de origen).
 */
export function isSameDepartment(
  evaluatorDepartment: string | null | undefined,
  piDepartment: string | null | undefined,
): boolean {
  const left = normalizeDepartment(evaluatorDepartment);
  const right = normalizeDepartment(piDepartment);
  return left !== null && right !== null && left === right;
}

/** BR-004 (parcial): el evaluador pertenece al equipo del proyecto. */
export function isSelfReview(
  evaluatorId: string,
  teamMemberIds: string[],
): boolean {
  return teamMemberIds.includes(evaluatorId);
}

/** UC-003 (precondicion): solo Proposed o Under_Review admiten decision. */
export function canEvaluateStatus(status: string): boolean {
  return (EVALUABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * RF-003: estado resultante de cada decision. Revision_Required reusa
 * Under_Review (decision del dueno: no se crea el estado
 * Modification_Requested del diccionario).
 */
export function statusAfterDecision(decision: EvaluationDecisionValue): string {
  return STATUS_AFTER_DECISION[decision];
}

/** RF-019: justificacion obligatoria (no vacia) y acotada. */
export function validateJustification(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'La justificacion de la decision es obligatoria (RF-019).';
  }
  if (value.trim().length > JUSTIFICATION_MAX_LENGTH) {
    return `La justificacion excede ${JUSTIFICATION_MAX_LENGTH} caracteres.`;
  }
  return null;
}
