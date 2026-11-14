import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import { notifyUser } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { uploadEvidenceDocument } from '../document_upload/document-upload.service.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import { MilestoneStatus } from '../generated/prisma/client.js';
import {
  normalizePageArgs,
  orderByFrom,
  PAGINATION_MAX_PAGE_SIZE,
  type PageArgs,
} from '../common/pagination/pagination.policy.js';
import {
  daysOverdue,
  dueNoticeThreshold,
  MILESTONE_ERROR_CODES,
  MILESTONE_SCAN_BATCH_SIZE,
  resolveMilestoneDelayDays,
  validateMilestoneName,
} from './milestones.constants.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateMilestoneInput {
  projectId: number;
  name: string;
  assigneeId: string;
  dueDate: string;
}

export interface UpdateMilestoneInput {
  name?: string | null;
  dueDate?: string | null;
}

export interface MilestoneScanSummary {
  delayed: number;
  notices: number;
}

interface MilestoneWithAssignee {
  milestone_id: number;
  project_id: number;
  name: string;
  assignee_id: string;
  due_date: Date;
  status: string;
  last_progress_at: Date;
  assignee?: { name: string };
}

function toView(row: MilestoneWithAssignee, assigneeName?: string) {
  return {
    milestoneId: row.milestone_id,
    projectId: row.project_id,
    name: row.name,
    assigneeId: row.assignee_id,
    assigneeName: assigneeName ?? row.assignee?.name ?? '',
    dueDate: row.due_date,
    status: row.status,
    lastProgressAt: row.last_progress_at,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDueDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new GraphQLError('La fecha compromiso no es valida.', {
      extensions: { code: MILESTONE_ERROR_CODES.VALIDATION_ERROR },
    });
  }
  return parsed;
}

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  // Para el Dashboard (trae las tareas del proyecto)
  async getMilestones(
    user: AuthenticatedUser,
    projectId: number,
    paging: PageArgs = {},
  ) {
    // RF-001/RF-006: solo el equipo del proyecto, coordinacion y
    // administracion pueden leer los hitos. El comite no ve la ejecucion.
    const isInstitutionalReader =
      user.role === ROLES.COORDINATOR || user.role === ROLES.ADMINISTRATOR;
    if (!isInstitutionalReader) {
      const membership = await prisma.project_User.findFirst({
        where: { project_id: projectId, user_id: user.id },
      });
      if (!membership) {
        throw new GraphQLError(
          'No tienes acceso a los hitos de este proyecto.',
          { extensions: { code: 'FORBIDDEN' } },
        );
      }
    }

    // Si es estudiante, solo ve sus tareas. Si es PI, ve todas.
    const where: any = { project_id: projectId };
    if (user.role === ROLES.STUDENT) {
      where.assignee_id = user.id;
    }
    // F2-03 / RF-013: paginacion y orden del lado del servidor.
    const ordering = normalizePageArgs(
      { ...paging, pageSize: paging.pageSize ?? PAGINATION_MAX_PAGE_SIZE },
      ['dueDate', 'status', 'name'],
      { sortBy: 'dueDate', sortDir: 'asc' },
    );
    const rows = await prisma.milestone.findMany({
      where,
      orderBy:
        orderByFrom(ordering, {
          dueDate: 'due_date',
          status: 'status',
          name: 'name',
        }) ?? { due_date: 'asc' },
      skip: ordering.skip,
      take: ordering.take,
      include: { assignee: { select: { name: true } } },
    });
    // GraphQL expone camelCase; Prisma devuelve columnas snake_case.
    return rows.map((row) => toView(row));
  }

  /** F2-07 / RF-006: alta de hito por el PI del proyecto. */
  async createMilestone(
    user: AuthenticatedUser,
    input: CreateMilestoneInput,
    ip: string,
  ) {
    const name = validateMilestoneName(input.name);
    const dueDate = parseDueDate(input.dueDate);
    const project = await this.requireManageableProject(
      user,
      input.projectId,
    );
    assertProjectWritable(project as { is_read_only?: boolean | null });
    const assignee = await this.requireProjectMember(
      input.projectId,
      input.assigneeId,
    );

    return prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.create({
        data: {
          project_id: input.projectId,
          name,
          assignee_id: assignee.id,
          due_date: dueDate,
          status: 'Pending',
          last_progress_at: new Date(),
        },
      });

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: 'milestone_created',
          target_id: String(milestone.milestone_id),
          source_ip: ip,
        },
      });

      if (assignee.id !== user.id) {
        await notifyUser(tx, assignee.id, {
          type: 'Milestone',
          title: 'Nuevo hito asignado',
          message:
            `Se te asigno el hito "${name}" del proyecto ` +
            `"${project.title}" con fecha compromiso ` +
            `${dueDate.toISOString().slice(0, 10)}.`,
          link: `/projects/${input.projectId}`,
        });
      }

      return toView(
        { ...milestone, assignee: { name: assignee.name } },
        assignee.name,
      );
    });
  }

  /** F2-07: edicion de nombre y fecha compromiso. */
  async updateMilestone(
    user: AuthenticatedUser,
    milestoneId: number,
    input: UpdateMilestoneInput,
    ip: string,
  ) {
    const milestone = await this.requireMilestone(milestoneId);
    const project = await this.requireManageableProject(
      user,
      milestone.project_id,
    );
    assertProjectWritable(project as { is_read_only?: boolean | null });

    const data: { name?: string; due_date?: Date; due_notice_days?: number } =
      {};
    if (input.name !== undefined && input.name !== null) {
      data.name = validateMilestoneName(input.name);
    }
    if (input.dueDate !== undefined && input.dueDate !== null) {
      data.due_date = parseDueDate(input.dueDate);
      // Una nueva fecha vuelve a habilitar los avisos de BR-008.
      data.due_notice_days = 0;
    }
    if (Object.keys(data).length === 0) {
      throw new GraphQLError('No se recibio ningun cambio para el hito.', {
        extensions: { code: MILESTONE_ERROR_CODES.VALIDATION_ERROR },
      });
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { milestone_id: milestoneId },
        data,
        include: { assignee: { select: { name: true } } },
      });
      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: 'milestone_updated',
          target_id: String(milestoneId),
          source_ip: ip,
        },
      });
      return toView(updated);
    });
  }

  /**
   * F2-07 / RF-006: el asignado reporta avance. Marcar Completed notifica al
   * PI; volver a Pending limpia el estado de retraso.
   */
  async updateMilestoneProgress(
    user: AuthenticatedUser,
    milestoneId: number,
    status: 'Pending' | 'Completed',
    ip: string,
  ) {
    if (status !== 'Pending' && status !== 'Completed') {
      throw new GraphQLError(
        'El estado solo puede ser Pending o Completed.',
        { extensions: { code: MILESTONE_ERROR_CODES.VALIDATION_ERROR } },
      );
    }
    const milestone = await this.requireMilestone(milestoneId);
    const project = await prisma.project.findUnique({
      where: { project_id: milestone.project_id },
      select: { is_read_only: true, title: true },
    });
    if (!project) {
      throw new GraphQLError('Proyecto no encontrado.', {
        extensions: { code: MILESTONE_ERROR_CODES.NOT_FOUND },
      });
    }
    assertProjectWritable(project);

    const isManager = await this.canManage(user, milestone.project_id);
    if (milestone.assignee_id !== user.id && !isManager) {
      throw new GraphQLError(
        'Solo el usuario asignado o el Investigador Principal puede reportar avance.',
        { extensions: { code: MILESTONE_ERROR_CODES.FORBIDDEN } },
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { milestone_id: milestoneId },
        data: {
          status,
          last_progress_at: new Date(),
          due_notice_days: 0,
        },
        include: { assignee: { select: { name: true } } },
      });

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action:
            status === 'Completed'
              ? 'milestone_completed'
              : 'milestone_progress_updated',
          target_id: String(milestoneId),
          source_ip: ip,
        },
      });

      if (status === 'Completed' && milestone.assignee_id !== user.id) {
        await notifyUser(tx, milestone.assignee_id, {
          type: 'Milestone',
          title: 'Hito completado',
          message: `El hito "${milestone.name}" se marco como completado.`,
          link: `/projects/${milestone.project_id}`,
        });
      } else if (status === 'Completed') {
        const managers = await tx.project_User.findMany({
          where: {
            project_id: milestone.project_id,
            project_role: 'Principal_Investigator',
            user_id: { not: user.id },
          },
          select: { user_id: true },
        });
        for (const manager of managers) {
          await notifyUser(tx, manager.user_id, {
            type: 'Milestone',
            title: 'Hito completado',
            message:
              `${user.name} marco como completado el hito ` +
              `"${milestone.name}" de "${project.title}".`,
            link: `/projects/${milestone.project_id}`,
          });
        }
      }

      return toView(updated);
    });
  }

  /** F2-07: reasignacion de un hito a otro miembro del equipo. */
  async assignMilestone(
    user: AuthenticatedUser,
    milestoneId: number,
    assigneeId: string,
    ip: string,
  ) {
    const milestone = await this.requireMilestone(milestoneId);
    const project = await this.requireManageableProject(
      user,
      milestone.project_id,
    );
    assertProjectWritable(project as { is_read_only?: boolean | null });
    const assignee = await this.requireProjectMember(
      milestone.project_id,
      assigneeId,
    );

    return prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { milestone_id: milestoneId },
        data: {
          assignee_id: assignee.id,
          last_progress_at: new Date(),
        },
      });
      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: 'milestone_reassigned',
          target_id: String(milestoneId),
          source_ip: ip,
        },
      });
      if (assignee.id !== user.id) {
        await notifyUser(tx, assignee.id, {
          type: 'Milestone',
          title: 'Hito asignado',
          message:
            `Se te asigno el hito "${milestone.name}" del proyecto ` +
            `"${project.title}".`,
          link: `/projects/${milestone.project_id}`,
        });
      }
      return toView(updated, assignee.name);
    });
  }

  /** F2-07: solo se elimina un hito sin evidencia documental asociada. */
  async deleteMilestone(
    user: AuthenticatedUser,
    milestoneId: number,
    ip: string,
  ): Promise<boolean> {
    const milestone = await this.requireMilestone(milestoneId);
    const project = await this.requireManageableProject(
      user,
      milestone.project_id,
    );
    assertProjectWritable(project as { is_read_only?: boolean | null });

    const evidence = await prisma.projectDocument.count({
      where: { milestone_id: milestoneId },
    });
    if (evidence > 0) {
      throw new GraphQLError(
        'No se puede eliminar un hito con evidencia cargada.',
        { extensions: { code: MILESTONE_ERROR_CODES.MILESTONE_HAS_EVIDENCE } },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.milestone.delete({ where: { milestone_id: milestoneId } });
      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: 'milestone_deleted',
          target_id: String(milestoneId),
          source_ip: ip,
        },
      });
    });
    return true;
  }

  // US 5.2: Subir evidencia — la tarea queda en Pending para que el PI la confirme.
  async uploadEvidenceAndComplete(
    user: AuthenticatedUser,
    milestoneId: number,
    file: any,
    ip: string,
  ) {
    const milestone = await prisma.milestone.findUnique({
      where: { milestone_id: milestoneId },
    });

    if (!milestone) {
      throw new GraphQLError('Tarea no encontrada.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // El criterio de aceptacion: solo el asignado puede subir evidencia.
    if (milestone.assignee_id !== user.id) {
      throw new GraphQLError(
        'Solo el usuario asignado puede subir evidencia a esta tarea.',
        { extensions: { code: 'FORBIDDEN' } },
      );
    }

    // RF-020: si el proyecto fue archivado, el hito y su evidencia son inmutables.
    const project = await prisma.project.findUnique({
      where: { project_id: milestone.project_id },
    });
    if (!project) {
      throw new GraphQLError('Proyecto no encontrado.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    assertProjectWritable(project as { is_read_only?: boolean | null });

    // 1-2. Subimos el archivo y lo vinculamos al hito en la misma
    // transaccion (documento + auditoria). Ya no hay un UPDATE posterior
    // que pueda dejar el documento sin hito.
    await uploadEvidenceDocument(
      user,
      milestone.project_id,
      file,
      ip,
      { milestoneId: milestone.milestone_id },
    );

    // Subir evidencia cuenta como avance para BR-008.
    await prisma.milestone.update({
      where: { milestone_id: milestoneId },
      data: { last_progress_at: new Date() },
    });

    // RF-014: avisa al PI que hay evidencia nueva. Es fail-soft: la
    // evidencia ya quedo persistida y un fallo al notificar no la revierte.
    try {
      const pi = await prisma.project_User.findFirst({
        where: {
          project_id: milestone.project_id,
          project_role: 'Principal_Investigator',
        },
        select: { user_id: true },
      });
      if (pi && pi.user_id !== user.id) {
        await notifyUser(prisma, pi.user_id, {
          type: 'Evidence',
          title: 'Nueva evidencia de trabajo',
          message:
            `${user.name} subio evidencia para la tarea "${milestone.name}" ` +
            `del proyecto ${milestone.project_id}.`,
          link: `/projects/${milestone.project_id}/documents`,
        });
      }
    } catch (error) {
      this.logger.error(
        'No se pudo notificar la evidencia al Investigador Principal.',
        error as Error,
      );
    }

    // 3. La tarea permanece en su estado actual (Pending o Delayed).
    //    El PRINCIPAL_INVESTIGATOR es quien la confirma mediante confirmMilestone.
    const updated = await prisma.milestone.findUnique({
      where: { milestone_id: milestoneId },
      include: { assignee: { select: { name: true } } },
    });
    return updated ? toView(updated) : null;
  }

  // Confirmacion de tarea por el PI: transiciona la tarea a Completed.
  async confirmMilestone(pi: AuthenticatedUser, milestoneId: number) {
    if (pi.role !== ROLES.PRINCIPAL_INVESTIGATOR) {
      throw new GraphQLError(
        'Solo el Investigador Principal puede confirmar tareas.',
        { extensions: { code: 'FORBIDDEN' } },
      );
    }
    const milestone = await this.requireMilestone(milestoneId);
    const membership = await prisma.project_User.findFirst({
      where: { project_id: milestone.project_id, user_id: pi.id },
    });
    if (!membership) {
      throw new GraphQLError('No tienes acceso a este proyecto.', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // RF-020: proyecto archivado → inmutable.
    const project = await prisma.project.findUnique({
      where: { project_id: milestone.project_id },
    });
    if (!project) {
      throw new GraphQLError('Proyecto no encontrado.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    assertProjectWritable(project as { is_read_only?: boolean | null });

    // RF-014: la confirmacion y la notificacion al asignado entran en la
    // misma transaccion; el correo se envia luego desde la outbox.
    return prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { milestone_id: milestoneId },
        data: { status: 'Completed' },
        include: { assignee: { select: { name: true } } },
      });
      if (milestone.assignee_id !== pi.id) {
        await notifyUser(tx, milestone.assignee_id, {
          type: 'Milestone',
          title: 'Tarea confirmada',
          message:
            `El Investigador Principal confirmo la tarea "${milestone.name}" ` +
            `del proyecto ${milestone.project_id}.`,
          link: `/projects/${milestone.project_id}/documents`,
        });
      }
      return toView(updated);
    });
  }

  /**
   * BR-008: job diario. Marca Delayed los hitos Pending sin avance en los
   * ultimos N dias (o ya vencidos) y envia los avisos de 30/15/5 dias.
   * Es idempotente: cada aviso se registra en `due_notice_days`.
   */
  async runDailyScan(now: Date = new Date()): Promise<MilestoneScanSummary> {
    const delayed = await this.markDelayed(now);
    const notices = await this.sendDueNotices(now);
    return { delayed, notices };
  }

  private async markDelayed(now: Date): Promise<number> {
    const delayDays = resolveMilestoneDelayDays();
    const cutoff = new Date(now.getTime() - delayDays * DAY_MS);
    const today = startOfDay(now);

    const candidates = await prisma.milestone.findMany({
      where: {
        status: MilestoneStatus.Pending,
        OR: [{ last_progress_at: { lte: cutoff } }, { due_date: { lt: today } }],
      },
      take: MILESTONE_SCAN_BATCH_SIZE,
      include: {
        project: { select: { title: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    let count = 0;
    for (const milestone of candidates) {
      try {
        const claimed = await prisma.$transaction(async (tx) => {
          const result = await tx.milestone.updateMany({
            where: {
              milestone_id: milestone.milestone_id,
              status: MilestoneStatus.Pending,
            },
            data: { status: 'Delayed' },
          });
          if (result.count === 0) {
            return false;
          }

          const overdue = daysOverdue(milestone.due_date, now);
          const message =
            overdue > 0
              ? `El hito "${milestone.name}" de "${milestone.project.title}" ` +
                `vencio hace ${overdue} dia(s) y sigue pendiente.`
              : `El hito "${milestone.name}" de "${milestone.project.title}" ` +
                `lleva mas de ${delayDays} dias sin avance.`;
          await notifyUser(tx, milestone.assignee_id, {
            type: 'Milestone',
            title: 'Hito retrasado',
            message,
            link: `/projects/${milestone.project_id}`,
          });
          const managers = await tx.project_User.findMany({
            where: {
              project_id: milestone.project_id,
              project_role: 'Principal_Investigator',
              user_id: { not: milestone.assignee_id },
            },
            select: { user_id: true },
          });
          for (const manager of managers) {
            await notifyUser(tx, manager.user_id, {
              type: 'Milestone',
              title: 'Hito retrasado',
              message,
              link: `/projects/${milestone.project_id}`,
            });
          }
          return true;
        });
        if (claimed) {
          count += 1;
        }
      } catch (error) {
        this.logger.error(
          `No se pudo marcar como retrasado el hito ${milestone.milestone_id}.`,
          error as Error,
        );
      }
    }
    return count;
  }

  private async sendDueNotices(now: Date): Promise<number> {
    const today = startOfDay(now);
    const windowEnd = new Date(now.getTime() + 31 * DAY_MS);
    const candidates = await prisma.milestone.findMany({
      where: {
        status: { in: [MilestoneStatus.Pending, MilestoneStatus.Delayed] },
        due_date: { gte: today, lte: windowEnd },
      },
      take: MILESTONE_SCAN_BATCH_SIZE,
      include: {
        project: { select: { title: true } },
        assignee: { select: { id: true } },
      },
    });

    let count = 0;
    for (const milestone of candidates) {
      const threshold = dueNoticeThreshold(milestone.due_date, now);
      if (threshold === 0 || milestone.due_notice_days >= threshold) {
        continue;
      }

      try {
        const claimed = await prisma.$transaction(async (tx) => {
          const result = await tx.milestone.updateMany({
            where: {
              milestone_id: milestone.milestone_id,
              due_notice_days: { lt: threshold },
              status: {
                in: [MilestoneStatus.Pending, MilestoneStatus.Delayed],
              },
            },
            data: { due_notice_days: threshold },
          });
          if (result.count === 0) {
            return false;
          }

          const message =
            `El hito "${milestone.name}" de "${milestone.project.title}" ` +
            `vence en ${threshold} dia(s) ` +
            `(${milestone.due_date.toISOString().slice(0, 10)}).`;
          await notifyUser(tx, milestone.assignee_id, {
            type: 'Milestone',
            title: `Aviso: hito por vencer en ${threshold} dias`,
            message,
            link: `/projects/${milestone.project_id}`,
          });
          const managers = await tx.project_User.findMany({
            where: {
              project_id: milestone.project_id,
              project_role: 'Principal_Investigator',
              user_id: { not: milestone.assignee_id },
            },
            select: { user_id: true },
          });
          for (const manager of managers) {
            await notifyUser(tx, manager.user_id, {
              type: 'Milestone',
              title: `Aviso: hito por vencer en ${threshold} dias`,
              message,
              link: `/projects/${milestone.project_id}`,
            });
          }
          return true;
        });
        if (claimed) {
          count += 1;
        }
      } catch (error) {
        this.logger.error(
          `No se pudo enviar el aviso del hito ${milestone.milestone_id}.`,
          error as Error,
        );
      }
    }
    return count;
  }

  private async requireMilestone(milestoneId: number) {
    const milestone = await prisma.milestone.findUnique({
      where: { milestone_id: milestoneId },
    });
    if (!milestone) {
      throw new GraphQLError('Tarea no encontrada.', {
        extensions: { code: MILESTONE_ERROR_CODES.NOT_FOUND },
      });
    }
    return milestone;
  }

  private async canManage(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<boolean> {
    if (user.role === ROLES.ADMINISTRATOR) {
      return true;
    }
    const membership = await prisma.project_User.findFirst({
      where: {
        project_id: projectId,
        user_id: user.id,
        project_role: 'Principal_Investigator',
      },
      select: { projectuser_id: true },
    });
    return membership !== null;
  }

  private async requireManageableProject(
    user: AuthenticatedUser,
    projectId: number,
  ) {
    const project = await prisma.project.findUnique({
      where: { project_id: projectId },
      select: {
        project_id: true,
        title: true,
        status: true,
        is_read_only: true,
      },
    });
    if (!project) {
      throw new GraphQLError('Proyecto no encontrado.', {
        extensions: { code: MILESTONE_ERROR_CODES.NOT_FOUND },
      });
    }
    if (!(await this.canManage(user, projectId))) {
      throw new GraphQLError(
        'Solo el Investigador Principal puede gestionar los hitos.',
        { extensions: { code: MILESTONE_ERROR_CODES.FORBIDDEN } },
      );
    }
    return project;
  }

  private async requireProjectMember(projectId: number, userId: string) {
    const member = await prisma.project_User.findFirst({
      where: { project_id: projectId, user_id: userId },
      select: { user: { select: { id: true, name: true } } },
    });
    if (!member) {
      throw new GraphQLError(
        'El usuario asignado debe pertenecer al equipo del proyecto.',
        { extensions: { code: MILESTONE_ERROR_CODES.INVALID_ASSIGNEE } },
      );
    }
    return member.user;
  }
}
