import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { CALL_ERROR_CODES } from './calls.constants.js';
import {
  CallError,
  enrollUnderRowLock,
  fail,
  type CallSnapshot,
} from './calls.enrollment.js';
import { validateCreateCallInput } from './calls.policy.js';

export { CallError };

function requireAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'ADMINISTRATOR') {
    fail(
      CALL_ERROR_CODES.FORBIDDEN,
      'Solo un Administrador puede publicar convocatorias.',
      403,
    );
  }
}

export interface CreateCallData {
  title: string;
  description: string;
  deadline: Date;
  applicationCap: number;
}

/**
 * US 2.2: el admin crea la convocatoria en DRAFT (aun no recibe nada).
 * La publicacion efectiva es `publishCall`.
 */
export async function createCall(user: AuthenticatedUser, data: CreateCallData) {
  requireAdmin(user);
  const issues = validateCreateCallInput({
    title: data.title,
    description: data.description,
    deadline: data.deadline,
    applicationCap: data.applicationCap,
  });
  if (issues.length > 0) {
    const first = issues[0] as { field: string; message: string };
    fail(CALL_ERROR_CODES.VALIDATION_ERROR, first.message, 400, first.field);
  }
  return prisma.announcement.create({
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      deadline: data.deadline,
      application_cap: data.applicationCap,
      status: 'DRAFT',
    },
  });
}

/**
 * US 2.2: publica la convocatoria (DRAFT -> OPEN) y fija date_published.
 * Solo si el deadline sigue futuro.
 */
export async function publishCall(user: AuthenticatedUser, callId: number) {
  requireAdmin(user);
  const call = await prisma.announcement.findUnique({
    where: { call_id: callId },
  });
  if (!call) {
    // throw directo (no fail()): TS 6 solo estrecha `call` tras un throw.
    throw new CallError(CALL_ERROR_CODES.NOT_FOUND, 'La convocatoria no existe.', 404);
  }
  if (call.status === 'OPEN') return call;
  if (call.status === 'CLOSED') {
    fail(
      CALL_ERROR_CODES.CONFLICT,
      'La convocatoria esta cerrada y no puede reabrirse.',
      409,
    );
  }
  if (call.deadline <= new Date()) {
    fail(
      CALL_ERROR_CODES.VALIDATION_ERROR,
      'El deadline ya paso; actualiza la fecha antes de publicar.',
      400,
      'deadline',
    );
  }
  return prisma.announcement.update({
    where: { call_id: callId },
    data: { status: 'OPEN', date_published: new Date() },
  });
}

/** Cierre manual del admin (idempotente). */
export async function closeCall(user: AuthenticatedUser, callId: number) {
  requireAdmin(user);
  const call = await prisma.announcement.findUnique({
    where: { call_id: callId },
  });
  if (!call) {
    // throw directo (no fail()): TS 6 solo estrecha `call` tras un throw.
    throw new CallError(CALL_ERROR_CODES.NOT_FOUND, 'La convocatoria no existe.', 404);
  }
  if (call.status === 'CLOSED') return call;
  return prisma.announcement.update({
    where: { call_id: callId },
    data: { status: 'CLOSED' },
  });
}

/**
 * Cierre automatico por deadline (RF-018). Lo invoca el programador
 * periodico y puede dispararse manualmente. Devuelve cuantas se cerraron.
 */
export async function closeExpiredCalls(now: Date = new Date()) {
  const result = await prisma.announcement.updateMany({
    where: { status: 'OPEN', deadline: { lte: now } },
    data: { status: 'CLOSED' },
  });
  return result.count;
}

/** Convocatorias abiertas con deadline futuro (lazy: excluye vencidas). */
export function openCalls(now: Date = new Date()) {
  return prisma.announcement.findMany({
    where: { status: 'OPEN', deadline: { gt: now } },
    orderBy: { deadline: 'asc' },
  });
}

export function getCall(callId: number) {
  return prisma.announcement.findUnique({ where: { call_id: callId } });
}

// ---------------------------------------------------------------------------
// Postulacion con row-level locking (RF-018: cierre por cupo sin overbooking)
// ---------------------------------------------------------------------------

export interface SubmitProposalData {
  title: string;
  objectives: string;
  startDate: Date;
  endDate: Date;
  callId: number;
}

/**
 * Postula un proyecto a una convocatoria con bloqueo de fila (RF-018).
 * `prisma.$transaction` + `SELECT ... FOR UPDATE` serializa las
 * postulaciones concurrentes: jamas se supera `application_cap`.
 *
 * NOTA Neon: el pooler en modo transaccion no soporta transacciones
 * interactivas; para este flujo usar la URL directa (ver .env.example).
 */
export function submitProposalToCall(
  user: AuthenticatedUser,
  data: SubmitProposalData,
) {
  return prisma.$transaction(async (tx) => {
    return enrollUnderRowLock(
      {
        queryCallForUpdate: async (id: number) => {
          const rows = await tx.$queryRaw<CallSnapshot[]>`
            SELECT "call_id", "status", "deadline", "application_cap", "application_count"
            FROM "Announcement"
            WHERE "call_id" = ${id}
            FOR UPDATE`;
          return rows[0] ?? null;
        },
        markClosed: async (id: number) => {
          await tx.announcement.update({
            where: { call_id: id },
            data: { status: 'CLOSED' },
          });
        },
        incrementCount: async (id: number) => {
          const updated = await tx.announcement.update({
            where: { call_id: id },
            data: { application_count: { increment: 1 } },
          });
          return updated as unknown as CallSnapshot;
        },
      },
      data.callId,
      new Date(),
      () =>
        tx.project.create({
          data: {
            title: data.title.trim(),
            objectives: data.objectives.trim(),
            start_date: data.startDate,
            end_date: data.endDate,
            call_id: data.callId,
            is_confidential: false,
            projectUsers: {
              create: {
                user_id: user.id,
                project_role: 'Principal_Investigator',
              },
            },
          },
        }),
    );
  });
}
