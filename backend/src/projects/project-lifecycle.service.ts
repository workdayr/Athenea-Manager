import { Injectable } from '@nestjs/common';
import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import type { Prisma, ProjectStatus } from '../generated/prisma/client.js';
import { notifyRole, notifyUser } from '../notifications/notifications.service.js';
import {
  computeRetentionDeleteAt,
  requiresEthicsApproval,
} from './project-ethics.policy.js';
import { resolveRetentionYears } from './project-ethics.constants.js';
import {
  LIFECYCLE_ERROR_CODES,
  REVIEW_SLA_BATCH_SIZE,
  resolveSlaReviewDays,
} from './project-lifecycle.constants.js';
import {
  canRoleTransition,
  findTransitionRule,
  isProjectStatus,
  requiresJustification,
  validateJustification,
} from './project-lifecycle.policy.js';
import { assertProjectWritable } from './project-write-guard.js';
import { canViewConfidentialProject } from './project-visibility.policy.js';
import type { AuthenticatedUser } from './session.guard.js';

/** Error de dominio: se mapea a GraphQL (extensions.code). */
export class ProjectLifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new ProjectLifecycleError(code, message, httpStatus, field);
}

export interface TransitionResult {
  projectId: number;
  previousStatus: string;
  newStatus: string;
  transitionId: number;
  changedAt: Date;
}

export interface StatusHistoryRow {
  transition_id: number;
  project_id: number;
  from_status: string;
  to_status: string;
  justification: string | null;
  created_at: Date;
  actor: { name: string };
}

export interface SlaScanResult {
  scanned: number;
  notified: number;
}

interface ProjectFlagsRow {
  project_id: number;
  status: string;
  title: string;
  is_confidential: boolean;
  is_read_only?: boolean | null;
  research_involves_humans: boolean;
  research_involves_animals: boolean;
  uses_sensitive_data: boolean;
}

export interface ApplyTransitionParams {
  projectId: number;
  actorId: string;
  from: string;
  to: string;
  justification?: string | null;
  /** `undefined` = no tocar retencion; `null` = limpiarla. */
  retentionDeleteAt?: Date | null;
}

export interface ApplyTransitionResult {
  applied: boolean;
  transitionId: number | null;
  changedAt: Date | null;
}

/**
 * F1-02: aplica una transicion ya validada dentro de una transaccion.
 *
 * El `updateMany` condicionado por el estado de origen evita dobles
 * transiciones concurrentes (p. ej. dos subidas simultaneas del 5.º PDF).
 */
export async function applyStatusTransition(
  tx: Prisma.TransactionClient,
  params: ApplyTransitionParams,
): Promise<ApplyTransitionResult> {
  const now = new Date();
  const updated = await tx.project.updateMany({
    where: {
      project_id: params.projectId,
      status: params.from as ProjectStatus,
    },
    data: {
      status: params.to as ProjectStatus,
      status_changed_at: now,
      sla_notified_at: null,
      ...(params.retentionDeleteAt !== undefined
        ? {
            retention_delete_at: params.retentionDeleteAt,
            retention_notified_at: null,
            retention_deleted_at: null,
          }
        : {}),
    },
  });

  if (updated.count === 0) {
    return { applied: false, transitionId: null, changedAt: null };
  }

  const transition = await tx.project_Status_Transition.create({
    data: {
      project_id: params.projectId,
      actor_id: params.actorId,
      from_status: params.from as ProjectStatus,
      to_status: params.to as ProjectStatus,
      justification: params.justification?.trim() || null,
    },
  });

  return {
    applied: true,
    transitionId: transition.transition_id,
    changedAt: now,
  };
}

/**
 * BR-003 / BR-006: compuertas que deben cumplirse antes de una transicion.
 * Se evalua fuera de la transaccion de escritura (solo lecturas).
 */
export async function assertTransitionConditions(
  project: Pick<
    ProjectFlagsRow,
    | 'project_id'
    | 'research_involves_humans'
    | 'research_involves_animals'
    | 'uses_sensitive_data'
  >,
  toStatus: string,
): Promise<void> {
  if (toStatus === 'Approved' && requiresEthicsApproval(project)) {
    const ethics = await prisma.projectDocument.findFirst({
      where: {
        project_id: project.project_id,
        doc_type: 'ethics_approval',
        review_status: 'Approved',
      },
      select: { document_id: true },
    });
    if (!ethics) {
      fail(
        LIFECYCLE_ERROR_CODES.ETHICS_APPROVAL_REQUIRED,
        'El proyecto requiere una aprobacion de etica aprobada por la administracion antes de pasar a Approved (BR-006).',
        409,
      );
    }
  }

  if (toStatus === 'Completed') {
    const results = await prisma.projectDocument.findFirst({
      where: {
        project_id: project.project_id,
        doc_type: 'results',
        review_status: 'Approved',
      },
      select: { document_id: true },
    });
    if (!results) {
      fail(
        LIFECYCLE_ERROR_CODES.FINAL_REPORT_NOT_APPROVED,
        'El informe final (results) debe estar aprobado para completar el proyecto (BR-003).',
        409,
      );
    }
  }
}

async function assertProjectPrincipalInvestigator(
  projectId: number,
  userId: string,
): Promise<void> {
  const membership = await prisma.project_User.findFirst({
    where: {
      project_id: projectId,
      user_id: userId,
      project_role: 'Principal_Investigator',
    },
    select: { projectuser_id: true },
  });
  if (!membership) {
    fail(
      LIFECYCLE_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal del proyecto puede realizar esta transicion.',
      403,
    );
  }
}

function isDecisionTransition(from: string, to: string): boolean {
  return (
    (from === 'Proposed' || from === 'Under_Review') &&
    (to === 'Approved' || to === 'Rejected' || to === 'Under_Review')
  );
}

async function notifyTransition(
  tx: Prisma.TransactionClient,
  project: { project_id: number; title: string },
  actor: AuthenticatedUser,
  from: string,
  to: string,
): Promise<void> {
  const pi = await tx.project_User.findFirst({
    where: {
      project_id: project.project_id,
      project_role: 'Principal_Investigator',
    },
    select: { user_id: true },
  });
  if (!pi || pi.user_id === actor.id) {
    return;
  }
  await notifyUser(tx, pi.user_id, {
    type: isDecisionTransition(from, to) ? 'Decision' : 'System',
    title: 'Estado del proyecto actualizado',
    message: `El proyecto "${project.title}" cambio de ${from} a ${to}.`,
    link: `/projects/${project.project_id}/documents`,
  });
}

/**
 * F1-02 / RF-003: transiciones manuales, historial y job de SLA.
 */
@Injectable()
export class ProjectLifecycleService {
  async transition(
    user: AuthenticatedUser,
    projectId: number,
    toStatus: string,
    justification: string | null | undefined,
    ip: string,
  ): Promise<TransitionResult> {
    if (!isProjectStatus(toStatus)) {
      fail(
        LIFECYCLE_ERROR_CODES.VALIDATION_ERROR,
        'El estado de destino no es valido.',
        400,
        'toStatus',
      );
    }

    const project = (await prisma.project.findUnique({
      where: { project_id: projectId },
    })) as ProjectFlagsRow | null;
    if (!project) {
      fail(LIFECYCLE_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
    }

    assertProjectWritable(project);

    const from = project.status;
    const rule = findTransitionRule(from, toStatus);
    if (!rule) {
      fail(
        LIFECYCLE_ERROR_CODES.INVALID_TRANSITION,
        `La transicion ${from} -> ${toStatus} no esta permitida (RF-003).`,
        409,
        'toStatus',
      );
    }
    if (!canRoleTransition(user.role, from, toStatus)) {
      fail(
        LIFECYCLE_ERROR_CODES.FORBIDDEN,
        `Tu rol no puede ejecutar la transicion ${from} -> ${toStatus}.`,
        403,
      );
    }

    const justificationIssue = validateJustification(
      justification,
      requiresJustification(from, toStatus),
    );
    if (justificationIssue) {
      fail(
        LIFECYCLE_ERROR_CODES.VALIDATION_ERROR,
        justificationIssue,
        400,
        'justification',
      );
    }

    if (user.role === ROLES.PRINCIPAL_INVESTIGATOR) {
      await assertProjectPrincipalInvestigator(projectId, user.id);
    }

    // La mutacion directa no puede saltarse la decision formal del comite.
    if (toStatus === 'Approved' || toStatus === 'Rejected') {
      const decision = await prisma.proposal_Evaluation.findFirst({
        where: {
          project_id: projectId,
          decision: toStatus as 'Approved' | 'Rejected',
        },
        select: { evaluation_id: true },
      });
      if (!decision) {
        fail(
          LIFECYCLE_ERROR_CODES.DECISION_REQUIRED,
          'La transicion requiere una decision formal del comite registrada (RF-019).',
          409,
        );
      }
    }

    await assertTransitionConditions(project, toStatus);

    const retentionDeleteAt =
      toStatus === 'Completed'
        ? project.research_involves_humans
          ? computeRetentionDeleteAt(new Date(), resolveRetentionYears())
          : null
        : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const applied = await applyStatusTransition(tx, {
        projectId,
        actorId: user.id,
        from,
        to: toStatus,
        justification,
        retentionDeleteAt,
      });
      if (!applied.applied) {
        fail(
          LIFECYCLE_ERROR_CODES.INVALID_TRANSITION,
          'El proyecto cambio de estado durante la operacion. Recarga e intenta de nuevo.',
          409,
        );
      }

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: `project_status_transition:${from}->${toStatus}`,
          target_id: String(projectId),
          source_ip: ip,
        },
      });

      await notifyTransition(tx, project, user, from, toStatus);
      return applied;
    });

    return {
      projectId,
      previousStatus: from,
      newStatus: toStatus,
      transitionId: result.transitionId as number,
      changedAt: result.changedAt as Date,
    };
  }

  async history(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<StatusHistoryRow[]> {
    const project = await prisma.project.findUnique({
      where: { project_id: projectId },
      include: { projectUsers: { select: { user_id: true } } },
    });
    if (!project) {
      fail(LIFECYCLE_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
    }

    const isMember = project.projectUsers.some(
      (member) => member.user_id === user.id,
    );
    const isInstitutional = (
      [ROLES.ADMINISTRATOR, ROLES.COORDINATOR, ROLES.COMMITTEE] as string[]
    ).includes(user.role);
    if (!isMember && !isInstitutional) {
      fail(
        LIFECYCLE_ERROR_CODES.FORBIDDEN,
        'No tienes acceso al historial de este proyecto.',
        403,
      );
    }
    if (
      project.is_confidential &&
      !canViewConfidentialProject(user, isMember)
    ) {
      fail(
        LIFECYCLE_ERROR_CODES.FORBIDDEN,
        'El proyecto es confidencial y solo su equipo y los administradores pueden consultarlo (BR-007).',
        403,
      );
    }

    const rows = await prisma.project_Status_Transition.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      include: { actor: { select: { name: true } } },
    });
    return rows as unknown as StatusHistoryRow[];
  }

  /** F1-02: avisa a los administradores una sola vez por tramo de revision. */
  async runSlaScan(now: Date = new Date()): Promise<SlaScanResult> {
    const days = resolveSlaReviewDays();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const candidates = await prisma.project.findMany({
      where: {
        status: 'Under_Review',
        sla_notified_at: null,
        status_changed_at: { lte: cutoff },
      },
      select: { project_id: true, title: true },
      orderBy: { project_id: 'asc' },
      take: REVIEW_SLA_BATCH_SIZE,
    });

    let notified = 0;
    for (const candidate of candidates) {
      const claimed = await prisma.project.updateMany({
        where: {
          project_id: candidate.project_id,
          status: 'Under_Review',
          sla_notified_at: null,
          status_changed_at: { lte: cutoff },
        },
        data: { sla_notified_at: now },
      });
      if (claimed.count !== 1) {
        continue;
      }
      await notifyRole(prisma, ROLES.ADMINISTRATOR, {
        type: 'Sla',
        title: 'Proyecto en revision por mas de 30 dias',
        message: `El proyecto "${candidate.title}" lleva mas de ${days} dias en Under_Review sin decision del comite.`,
        link: `/projects/${candidate.project_id}/documents`,
      });
      notified += 1;
    }

    return { scanned: candidates.length, notified };
  }
}
