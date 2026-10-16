import { CALL_ERROR_CODES } from './calls.constants.js';

/** Error de dominio (misma forma que ProjectError, sin dependencia ciclica). */
export class CallError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

export const fail = (
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never => {
  throw new CallError(code, message, httpStatus, field);
};

export interface CallSnapshot {
  call_id: number;
  status: string;
  deadline: Date;
  application_cap: number;
  application_count: number;
}

/** Operaciones del tramo critico; en produccion van en una sola transaccion. */
export interface EnrollmentStore {
  /** SELECT ... FOR UPDATE: bloquea la fila hasta el commit. */
  queryCallForUpdate(callId: number): Promise<CallSnapshot | null>;
  markClosed(callId: number): Promise<void>;
  incrementCount(callId: number): Promise<CallSnapshot>;
}

/**
 * Núcleo del cierre por cupo (RF-018). Debe ejecutarse con la fila
 * bloqueada (FOR UPDATE): lee, valida deadline/cupo, crea y cuenta. Si el
 * incremento llena el cupo, marca CLOSED en la misma transaccion.
 *
 * Este modulo no importa Prisma: es testeable sin BD (ver calls.lock.spec).
 */
export async function enrollUnderRowLock<T>(
  store: EnrollmentStore,
  callId: number,
  now: Date,
  create: () => Promise<T>,
): Promise<{ result: T; closedByCap: boolean }> {
  const call = await store.queryCallForUpdate(callId);
  if (!call) {
    // throw directo (no fail()): TS 6 solo estrecha `call` tras un throw.
    throw new CallError(
      CALL_ERROR_CODES.VALIDATION_ERROR,
      'La convocatoria indicada no existe.',
      400,
      'callId',
    );
  }
  if (call.status !== 'OPEN') {
    fail(
      CALL_ERROR_CODES.CALL_CLOSED,
      'La convocatoria esta cerrada.',
      409,
      'callId',
    );
  }
  if (call.deadline <= now) {
    await store.markClosed(callId);
    fail(
      CALL_ERROR_CODES.CALL_CLOSED,
      'La convocatoria alcanzo su deadline.',
      409,
      'callId',
    );
  }
  if (call.application_count >= call.application_cap) {
    await store.markClosed(callId);
    fail(
      CALL_ERROR_CODES.CALL_FULL,
      'La convocatoria alcanzo su cupo maximo.',
      409,
      'callId',
    );
  }
  const result = await create();
  const updated = await store.incrementCount(callId);
  const closedByCap = updated.application_count >= updated.application_cap;
  if (closedByCap) {
    await store.markClosed(callId);
  }
  return { result, closedByCap };
}
