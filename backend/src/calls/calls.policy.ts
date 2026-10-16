import { CALL_TITLE_MAX_LENGTH } from './calls.constants.js';

export interface CallValidationIssue {
  field: string;
  message: string;
}

export interface CreateCallInputLike {
  title: unknown;
  description: unknown;
  deadline: unknown;
  application_cap?: unknown;
  applicationCap?: unknown;
}

/** Subconjunto de Announcement necesario para decidir apertura/cierre. */
export interface CallLike {
  status: string;
  deadline: Date;
  application_cap: number;
  application_count: number;
}

function toDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readCap(input: CreateCallInputLike): unknown {
  return input.application_cap ?? input.applicationCap;
}

/**
 * Validacion pura de publicacion (US 2.2): titulo <= 200, descripcion
 * obligatoria, deadline futuro y cupo entero >= 1. No toca la BD.
 */
export function validateCreateCallInput(
  input: CreateCallInputLike,
  now: Date = new Date(),
): CallValidationIssue[] {
  const issues: CallValidationIssue[] = [];
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    issues.push({ field: 'title', message: 'El titulo es obligatorio.' });
  } else if (input.title.trim().length > CALL_TITLE_MAX_LENGTH) {
    issues.push({
      field: 'title',
      message: `El titulo no debe exceder ${CALL_TITLE_MAX_LENGTH} caracteres.`,
    });
  }
  if (
    typeof input.description !== 'string' ||
    input.description.trim().length === 0
  ) {
    issues.push({
      field: 'description',
      message: 'La descripcion es obligatoria.',
    });
  }
  const deadline = toDate(input.deadline);
  if (!deadline) {
    issues.push({ field: 'deadline', message: 'El deadline es invalido.' });
  } else if (deadline <= now) {
    issues.push({
      field: 'deadline',
      message: 'El deadline debe ser una fecha futura.',
    });
  }
  const cap = readCap(input);
  if (!Number.isInteger(cap) || (cap as number) < 1) {
    issues.push({
      field: 'applicationCap',
      message: 'El cupo debe ser un entero mayor o igual a 1.',
    });
  }
  return issues;
}

/**
 * Motivo de cierre automatico (RF-018): 'EXPIRED' si paso el deadline,
 * 'FULL' si se alcanzo el cupo, null si sigue abierta.
 */
export function closeReason(
  call: CallLike,
  now: Date = new Date(),
): 'EXPIRED' | 'FULL' | null {
  if (call.status === 'CLOSED') return null;
  if (call.deadline <= now) return 'EXPIRED';
  if (call.application_count >= call.application_cap) return 'FULL';
  return null;
}

/** true si la convocatoria recibe postulaciones en este instante. */
export function isCallOpen(call: CallLike, now: Date = new Date()): boolean {
  return call.status === 'OPEN' && closeReason(call, now) === null;
}

/** Cupos restantes antes del cierre por capacidad. */
export function remainingCallSlots(call: CallLike): number {
  return Math.max(0, call.application_cap - call.application_count);
}
