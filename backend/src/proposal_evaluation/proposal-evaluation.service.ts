import { prisma } from '../db/prisma.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { isTransitionAllowed } from '../projects/project-lifecycle.policy.js';
import {
  applyStatusTransition,
  assertTransitionConditions,
} from '../projects/project-lifecycle.service.js';
import { getProjectWithTeamForEvaluation } from '../projects/projects.service.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import type {
  ConflictStatus,
  EvaluationDecision,
} from '../generated/prisma/client.js';
import {
  EVALUABLE_STATUSES,
  EVALUATION_DECISIONS,
  EVALUATION_ERROR_CODES,
  JUSTIFICATION_MAX_LENGTH,
  UNKNOWN_ACTOR_IP,
  conflictFlagAuditAction,
  conflictResolveAuditAction,
  decisionAuditAction,
} from './proposal-evaluation.constants.js';
import {
  canEvaluateStatus,
  detectFamilyConflict,
  isSelfReview,
  statusAfterDecision,
  validateJustification,
} from './proposal-evaluation.policy.js';

/** Error de dominio: se mapea a GraphQL (extensions.code/field). */
export class EvaluationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

export interface SubmitDecisionData {
  projectId: number;
  decision: string;
  justification: string;
}

export interface ResolveConflictData {
  conflictId: number;
  resolution: string;
  note: string;
}

const fail = (
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never => {
  throw new EvaluationError(code, message, httpStatus, field);
};

/** Defensa en profundidad: el guard ya filtra, el servicio no confia. */
function requireEvaluator(user: AuthenticatedUser): void {
  if (user.role !== 'COMMITTEE' && user.role !== 'COORDINATOR') {
    fail(
      EVALUATION_ERROR_CODES.FORBIDDEN,
      'Solo el Comite de Evaluacion o la Coordinacion pueden revisar propuestas.',
      403,
    );
  }
}

function requireAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'ADMINISTRATOR') {
    fail(
      EVALUATION_ERROR_CODES.FORBIDDEN,
      'Solo un Administrador puede resolver alertas de conflicto.',
      403,
    );
  }
}

interface TeamRow {
  user_id: string;
  user: { id: string; name: string; email: string };
  project_role: string;
}

interface ConflictRow {
  conflict_id: number;
  project_id: number;
  reviewer_id: string;
  status: string;
  detected_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

interface ProjectRow {
  project_id: number;
  title: string;
  objectives: string;
  start_date: Date;
  end_date: Date;
  status: string;
  research_involves_humans: boolean;
  research_involves_animals: boolean;
  uses_sensitive_data: boolean;
  projectUsers: TeamRow[];
}

function teamNames(project: Pick<ProjectRow, 'projectUsers'>): string[] {
  return project.projectUsers.map((member) => member.user.name);
}

function teamIds(project: Pick<ProjectRow, 'projectUsers'>): string[] {
  return project.projectUsers.map((member) => member.user_id);
}

/**
 * UC-003 paso 1: propuestas en Proposed/Under_Review con el estado de
 * conflicto del visor (computado al vuelo, sin persistir).
 */
export async function proposalsPendingReview(viewer: AuthenticatedUser) {
  requireEvaluator(viewer);
  const rows = (await prisma.project.findMany({
    where: { status: { in: [...EVALUABLE_STATUSES] } },
    orderBy: { project_id: 'desc' },
    include: {
      projectUsers: { include: { user: true } },
      conflicts: { where: { reviewer_id: viewer.id } },
    },
  })) as unknown as (ProjectRow & { conflicts: ConflictRow[] })[];
  return rows.map((row) => {
    const matched = detectFamilyConflict(viewer.name, teamNames(row));
    const conflict = row.conflicts[0] ?? null;
    return {
      project_id: row.project_id,
      title: row.title,
      status: row.status,
      hasConflict: matched.length > 0 || conflict?.status !== undefined,
      matchedSurnames: matched,
      conflictStatus: conflict?.status ?? null,
    };
  });
}

export interface ProposalContext {
  project_id: number;
  title: string;
  objectives: string;
  status: string;
  start_date: Date;
  end_date: Date;
  team: { user_id: string; name: string; email: string; project_role: string }[];
  evaluations: {
    evaluation_id: number;
    reviewer_id: string;
    reviewerName: string;
    decision: string;
    justification: string;
    created_at: Date;
  }[];
  conflict: ConflictRow | null;
  matchedSurnames: string[];
  canEvaluate: boolean;
  blockReason: string | null;
}

/**
 * UC-003 paso 2: detalle + equipo + estado de conflicto. Si detecta
 * coincidencia de apellidos sin registro previo, persiste la alerta
 * Pending (BR-011) junto a su fila de auditoria.
 */
export async function proposalContext(
  viewer: AuthenticatedUser,
  projectId: number,
  ip: string = UNKNOWN_ACTOR_IP,
): Promise<ProposalContext> {
  requireEvaluator(viewer);
  const row = (await prisma.project.findUnique({
    where: { project_id: projectId },
    include: {
      projectUsers: { include: { user: true } },
      conflicts: { where: { reviewer_id: viewer.id } },
      evaluations: {
        orderBy: { created_at: 'desc' },
        take: 10,
        include: { reviewer: true },
      },
    },
  })) as unknown as
    | (ProjectRow & {
        conflicts: ConflictRow[];
        evaluations: {
          evaluation_id: number;
          reviewer_id: string;
          reviewer: { name: string };
          decision: string;
          justification: string;
          created_at: Date;
        }[]
      })
    | null;
  if (!row) {
    // throw directo (no fail()): TS solo estrecha tras un throw
    // (mismo patron que calls.service.ts).
    throw new EvaluationError(
      EVALUATION_ERROR_CODES.NOT_FOUND,
      'El proyecto no existe.',
      404,
    );
  }
  const names = teamNames(row);
  const matched = detectFamilyConflict(viewer.name, names);
  let conflict = row.conflicts[0] ?? null;
  if (matched.length > 0 && !conflict) {
    conflict = (await prisma.review_Conflict.upsert({
      where: {
        project_id_reviewer_id: {
          project_id: projectId,
          reviewer_id: viewer.id,
        },
      },
      update: {},
      create: { project_id: projectId, reviewer_id: viewer.id },
    })) as unknown as ConflictRow;
    await prisma.audit_Log.create({
      data: {
        actor_id: viewer.id,
        action: conflictFlagAuditAction(),
        target_id: String(projectId),
        source_ip: ip,
      },
    });
  }
  const self = isSelfReview(viewer.id, teamIds(row));
  const blocked =
    !canEvaluateStatus(row.status) ||
    self ||
    (conflict !== null && conflict.status !== 'Cleared');
  const blockReason = !canEvaluateStatus(row.status)
    ? EVALUATION_ERROR_CODES.INVALID_STATE
    : self
      ? EVALUATION_ERROR_CODES.SELF_REVIEW
      : conflict !== null && conflict.status !== 'Cleared'
        ? EVALUATION_ERROR_CODES.FAMILY_CONFLICT
        : null;
  return {
    project_id: row.project_id,
    title: row.title,
    objectives: row.objectives,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    team: row.projectUsers.map((member) => ({
      user_id: member.user_id,
      name: member.user.name,
      email: member.user.email,
      project_role: member.project_role,
    })),
    evaluations: row.evaluations.map((item) => ({
      evaluation_id: item.evaluation_id,
      reviewer_id: item.reviewer_id,
      reviewerName: item.reviewer.name,
      decision: item.decision,
      justification: item.justification,
      created_at: item.created_at,
    })),
    conflict,
    matchedSurnames: matched,
    canEvaluate: !blocked,
    blockReason,
  };
}

/**
 * UC-003 pasos 5-6 + RF-019 + RF-003: registra la decision formal con
 * justificacion obligatoria y transiciona el estado del proyecto en una
 * sola transaccion junto a la fila de auditoria.
 *
 * NOTA Neon: igual que calls.service, usa `prisma.$transaction`
 * (transaccion interactiva); para este flujo usar la URL directa
 * (ver backend/.env.example).
 */
export async function submitProjectDecision(
  viewer: AuthenticatedUser,
  data: SubmitDecisionData,
  ip: string = UNKNOWN_ACTOR_IP,
) {
  requireEvaluator(viewer);
  if (!EVALUATION_DECISIONS.includes(data.decision as never)) {
    fail(
      EVALUATION_ERROR_CODES.VALIDATION_ERROR,
      'Decision invalida. Valores: Approved, Rejected, Revision_Required.',
      400,
      'decision',
    );
  }
  const justificationIssue = validateJustification(data.justification);
  if (justificationIssue) {
    fail(
      EVALUATION_ERROR_CODES.VALIDATION_ERROR,
      justificationIssue,
      400,
      'justification',
    );
  }

const row = (await getProjectWithTeamForEvaluation(data.projectId)) as unknown as ProjectRow | null;
  if (!row) {
    // throw directo (no fail()): TS solo estrecha tras un throw.
    throw new EvaluationError(
      EVALUATION_ERROR_CODES.NOT_FOUND,
      'El proyecto no existe.',
      404,
    );
  }
  if (!canEvaluateStatus(row.status)) {
    fail(
      EVALUATION_ERROR_CODES.INVALID_STATE,
      `El proyecto ya no admite decision (estado ${row.status}).`,
      409,
    );
  }
  if (isSelfReview(viewer.id, teamIds(row))) {
    fail(
      EVALUATION_ERROR_CODES.SELF_REVIEW,
      'No puedes evaluar un proyecto de tu propio equipo (BR-004).',
      403,
    );
  }
  const matched = detectFamilyConflict(viewer.name, teamNames(row));
  const existing = (await prisma.review_Conflict.findFirst({
    where: { project_id: data.projectId, reviewer_id: viewer.id },
  })) as unknown as ConflictRow | null;
  if (matched.length > 0 && !existing) {
    await prisma.review_Conflict.upsert({
      where: {
        project_id_reviewer_id: {
          project_id: data.projectId,
          reviewer_id: viewer.id,
        },
      },
      update: {},
      create: { project_id: data.projectId, reviewer_id: viewer.id },
    });
    await prisma.audit_Log.create({
      data: {
        actor_id: viewer.id,
        action: conflictFlagAuditAction(),
        target_id: String(data.projectId),
        source_ip: ip,
      },
    });
  }
  let conflict: ConflictRow | null = existing;
  if (!conflict && matched.length > 0) {
    conflict = (await prisma.review_Conflict.findFirst({
      where: { project_id: data.projectId, reviewer_id: viewer.id },
    })) as unknown as ConflictRow | null;
  }
  if (conflict && conflict.status !== 'Cleared') {
    fail(
      EVALUATION_ERROR_CODES.FAMILY_CONFLICT,
      `Conflicto de interes familiar (${conflict.status}): apellidos coincidentes: ${matched.join(', ') || 'registrados'}. Requiere revision del Administrador (BR-011).`,
      403,
    );
  }
  const from = row.status;
  const to = statusAfterDecision(
    data.decision as (typeof EVALUATION_DECISIONS)[number],
  );

  // F1-02: la decision debe ser una transicion valida de la maquina de
  // estados y cumplir las compuertas BR-006 (etica) antes de registrarse.
  if (!isTransitionAllowed(from, to)) {
    fail(
      EVALUATION_ERROR_CODES.INVALID_STATE,
      `La decision no puede aplicarse desde el estado ${from} (RF-003).`,
      409,
    );
  }
  await assertTransitionConditions(row, to);

  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.proposal_Evaluation.create({
      data: {
        project_id: data.projectId,
        reviewer_id: viewer.id,
        decision: data.decision as EvaluationDecision,
        justification: data.justification.trim(),
      },
    });
    // F1-02: el historial y el SLA se actualizan en la misma transaccion.
    const applied = await applyStatusTransition(tx, {
      projectId: data.projectId,
      actorId: viewer.id,
      from,
      to,
      justification: data.justification,
    });
    if (!applied.applied) {
      fail(
        EVALUATION_ERROR_CODES.INVALID_STATE,
        'El proyecto cambio de estado durante la operacion. Recarga e intenta de nuevo.',
        409,
      );
    }
    // RF-014: la notificacion y su correo entran en la misma transaccion
    // que la decision. El job de outbox los envia despues.
    const pi = row.projectUsers.find(
      (member) => member.project_role === 'Principal_Investigator',
    );
    if (pi) {
      await notifyUser(tx, pi.user_id, {
        type: 'Decision',
        title: 'Decision del comite evaluador',
        message:
          `Tu proyecto "${row.title}" fue evaluado con la decision ` +
          `${data.decision}. Nuevo estado: ${to}.`,
        link: `/projects/${data.projectId}/documents`,
      });
    }
    await tx.audit_Log.create({
      data: {
        actor_id: viewer.id,
        action: decisionAuditAction(from, to),
        target_id: String(data.projectId),
        source_ip: ip,
      },
    });
    return { ...evaluation, previousStatus: from, newStatus: to };
  });
}

export interface ConflictWithNames extends ConflictRow {
  projectTitle: string;
  reviewerName: string;
  matchedSurnames: string[];
}

/**
 * Cola de alertas pendientes para revision manual (BR-011).
 * Solo ADMINISTRATOR (el guard filtra; el servicio revalida).
 */
export async function pendingConflictReviews(): Promise<ConflictWithNames[]> {
  const rows = (await prisma.review_Conflict.findMany({
    where: { status: 'Pending' },
    orderBy: { detected_at: 'asc' },
    include: {
      project: { include: { projectUsers: { include: { user: true } } } },
      reviewer: true,
    },
  })) as unknown as (ConflictRow & {
    project: { title: string; projectUsers: TeamRow[] };
    reviewer: { name: string };
  })[];
  return rows.map((row) => ({
    ...row,
    projectTitle: row.project.title,
    reviewerName: row.reviewer.name,
    matchedSurnames: detectFamilyConflict(
      row.reviewer.name,
      row.project.projectUsers.map((member) => member.user.name),
    ),
  }));
}

/**
 * BR-011: el Administrador resuelve la alerta (Cleared = sin parentesco
 * real, habilita a ese par; Confirmed = conflicto real, bloqueo final).
 */
export async function resolveConflictReview(
  admin: AuthenticatedUser,
  data: ResolveConflictData,
  ip: string = UNKNOWN_ACTOR_IP,
) {
  requireAdmin(admin);
  if (data.resolution !== 'Cleared' && data.resolution !== 'Confirmed') {
    fail(
      EVALUATION_ERROR_CODES.VALIDATION_ERROR,
      'Resolucion invalida. Valores: Cleared, Confirmed.',
      400,
      'resolution',
    );
  }
  if (
    typeof data.note !== 'string' ||
    data.note.trim().length === 0 ||
    data.note.trim().length > JUSTIFICATION_MAX_LENGTH
  ) {
    fail(
      EVALUATION_ERROR_CODES.VALIDATION_ERROR,
      'La nota de resolucion es obligatoria (maximo 4000 caracteres).',
      400,
      'note',
    );
  }
  const row = (await prisma.review_Conflict.findUnique({
    where: { conflict_id: data.conflictId },
  })) as unknown as ConflictRow | null;
  if (!row) {
    // throw directo (no fail()): TS solo estrecha tras un throw.
    throw new EvaluationError(
      EVALUATION_ERROR_CODES.NOT_FOUND,
      'La alerta no existe.',
      404,
    );
  }
  if (row.status !== 'Pending') {
    // throw directo (no fail()): TS solo estrecha tras un throw.
    throw new EvaluationError(
      EVALUATION_ERROR_CODES.INVALID_STATE,
      `La alerta ya fue resuelta (${row.status}).`,
      409,
    );
  }
  const updated = (await prisma.review_Conflict.update({
    where: { conflict_id: data.conflictId },
    data: {
      status: data.resolution as ConflictStatus,
      resolved_at: new Date(),
      resolved_by: admin.id,
      resolution_note: data.note.trim(),
    },
    include: { project: true, reviewer: true },
  })) as unknown as ConflictRow & {
    project: { title: string };
    reviewer: { name: string };
  };
  await prisma.audit_Log.create({
    data: {
      actor_id: admin.id,
      action: conflictResolveAuditAction(data.conflictId, data.resolution),
      target_id: String(row.project_id),
      source_ip: ip,
    },
  });
  return {
    ...updated,
    projectTitle: updated.project.title,
    reviewerName: updated.reviewer.name,
    matchedSurnames: [],
  } satisfies ConflictWithNames;
}
