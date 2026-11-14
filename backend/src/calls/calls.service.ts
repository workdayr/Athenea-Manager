import { prisma } from '../db/prisma.js';
import { notifyRole } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  normalizePageArgs,
  orderByFrom,
  PAGINATION_MAX_PAGE_SIZE,
  type PageArgs,
} from '../common/pagination/pagination.policy.js';
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
export async function createCall(
  user: AuthenticatedUser,
  data: CreateCallData,
) {
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
  const created = await prisma.announcement.create({
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      deadline: data.deadline,
      application_cap: data.applicationCap,
      status: 'DRAFT',
    },
  });

  void notifyRole(prisma, 'ADMINISTRATOR', {
    type: 'System',
    title: 'Nueva convocatoria creada',
    message: `Se ha creado la convocatoria "${created.title}" (ID ${created.call_id}).`,
    link: `/calls/${created.call_id}`,
  }).catch(() => {
    /* notificacion best-effort */
  });

  return created;
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
    throw new CallError(
      CALL_ERROR_CODES.NOT_FOUND,
      'La convocatoria no existe.',
      404,
    );
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
  const published = await prisma.announcement.update({
    where: { call_id: callId },
    data: { status: 'OPEN', date_published: new Date() },
  });

  void notifyRole(prisma, 'ADMINISTRATOR', {
    type: 'System',
    title: 'Convocatoria publicada',
    message: `La convocatoria "${published.title}" (ID ${published.call_id}) esta abierta.`,
    link: `/calls/${published.call_id}`,
  }).catch(() => {
    /* notificacion best-effort */
  });

  return published;
}

/** Cierre manual del admin (idempotente). */
export async function closeCall(user: AuthenticatedUser, callId: number) {
  requireAdmin(user);
  const call = await prisma.announcement.findUnique({
    where: { call_id: callId },
  });
  if (!call) {
    // throw directo (no fail()): TS 6 solo estrecha `call` tras un throw.
    throw new CallError(
      CALL_ERROR_CODES.NOT_FOUND,
      'La convocatoria no existe.',
      404,
    );
  }
  if (call.status === 'CLOSED') return call;
  const closed = await prisma.announcement.update({
    where: { call_id: callId },
    data: { status: 'CLOSED' },
  });

  void notifyRole(prisma, 'ADMINISTRATOR', {
    type: 'System',
    title: 'Convocatoria cerrada',
    message: `La convocatoria "${closed.title}" (ID ${closed.call_id}) se ha cerrado.`,
    link: `/calls/${closed.call_id}`,
  }).catch(() => {
    /* notificacion best-effort */
  });

  return closed;
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

  if (result.count > 0) {
    void notifyRole(prisma, 'ADMINISTRATOR', {
      type: 'System',
      title: 'Convocatorias cerradas automaticamente',
      message: `Se cerraron ${result.count} convocatoria(s) vencidas.`,
      link: '/calls',
    }).catch(() => {
      /* notificacion best-effort */
    });
  }

  return result.count;
}

/** Convocatorias abiertas con deadline futuro (lazy: excluye vencidas). */
export function openCalls(now: Date = new Date(), paging: PageArgs = {}) {
  // F2-03 / RF-013: paginacion y orden del lado del servidor.
  const ordering = normalizePageArgs(
    { ...paging, pageSize: paging.pageSize ?? PAGINATION_MAX_PAGE_SIZE },
    ['deadline', 'title', 'applicationCount'],
    { sortBy: 'deadline', sortDir: 'asc' },
  );
  return prisma.announcement.findMany({
    where: { status: 'OPEN', deadline: { gt: now } },
    orderBy:
      orderByFrom(ordering, {
        deadline: 'deadline',
        title: 'title',
        applicationCount: 'application_count',
      }) ?? { deadline: 'asc' },
    skip: ordering.skip,
    take: ordering.take,
  });
}

/**
 * F1-09 / RF-018: listado institucional completo. El frontend muestra las
 * convocatorias vigentes y las cerradas (historial) en la misma pantalla.
 * Los borradores solo se exponen a la administracion: una convocatoria
 * sin publicar no debe filtrarse al resto de los roles.
 */
export function allCalls(
  status?: string | null,
  includeDrafts = false,
  paging: PageArgs = {},
) {
  const ordering = normalizePageArgs(
    { ...paging, pageSize: paging.pageSize ?? PAGINATION_MAX_PAGE_SIZE },
    ['deadline', 'title', 'status', 'applicationCount'],
    { sortBy: 'deadline', sortDir: 'desc' },
  );
  return prisma.announcement.findMany({
    where: status
      ? { status: status as never }
      : includeDrafts
        ? undefined
        : { status: { not: 'DRAFT' as never } },
    orderBy:
      orderByFrom(ordering, {
        deadline: 'deadline',
        title: 'title',
        status: 'status',
        applicationCount: 'application_count',
      }) ?? { deadline: 'desc' },
    skip: ordering.skip,
    take: ordering.take,
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
  researchInvolvesHumans?: boolean;
  researchInvolvesAnimals?: boolean;
  usesSensitiveData?: boolean;
  isConfidential?: boolean;
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
  return prisma
    .$transaction(async (tx) => {
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
        async () => {
          // RF-018: un PI no puede postular dos propuestas a la misma
          // convocatoria. La validacion corre dentro de la transaccion y tras
          // el SELECT ... FOR UPDATE, por lo que es segura bajo concurrencia.
          const existing = await tx.project.count({
            where: {
              call_id: data.callId,
              projectUsers: {
                some: {
                  user_id: user.id,
                  project_role: 'Principal_Investigator',
                },
              },
            },
          });
          if (existing > 0) {
            fail(
              CALL_ERROR_CODES.ALREADY_APPLIED,
              'Ya tienes una postulacion registrada en esta convocatoria.',
              409,
              'callId',
            );
          }

          return tx.project.create({
            data: {
              title: data.title.trim(),
              objectives: data.objectives.trim(),
              start_date: data.startDate,
              end_date: data.endDate,
              call_id: data.callId,
              is_confidential: data.isConfidential === true,
              research_involves_humans: data.researchInvolvesHumans === true,
              research_involves_animals: data.researchInvolvesAnimals === true,
              uses_sensitive_data: data.usesSensitiveData === true,
              // F1-02: el alta nace en Draft y pasa a Proposed al completar
              // los 5 documentos obligatorios, igual que el alta directa.
              status: 'Draft',
              projectUsers: {
                create: {
                  user_id: user.id,
                  project_role: 'Principal_Investigator',
                },
              },
            },
            include: {
              call: { select: { title: true } },
              projectUsers: {
                select: {
                  project_role: true,
                  user: { select: { name: true } },
                },
              },
              milestones: { select: { status: true } },
              expenses: { select: { amount: true } },
            },
          });
        },
      );
    })
    .catch(async (error: unknown) => {
      // RF-018: al rechazar por cupo lleno o deadline vencido,
      // `enrollUnderRowLock` marca la convocatoria como CLOSED dentro de la
      // transaccion, pero el `throw` la revierte. Se cierra despues del
      // rollback (condicionado a que siga OPEN) para no dejarla abierta sin
      // cupo ni vigencia.
      if (
        error instanceof CallError &&
        (error.code === CALL_ERROR_CODES.CALL_FULL ||
          error.code === CALL_ERROR_CODES.CALL_CLOSED)
      ) {
        await prisma.announcement.updateMany({
          where: { call_id: data.callId, status: 'OPEN' },
          data: { status: 'CLOSED' },
        });
      }
      throw error;
    });
}
