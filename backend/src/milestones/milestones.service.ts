import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import { notifyUser } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { uploadEvidenceDocument } from '../document_upload/document-upload.service.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);
  // Para el Dashboard (trae las tareas del proyecto)
  async getMilestones(user: AuthenticatedUser, projectId: number) {
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
    const rows = await prisma.milestone.findMany({
      where,
      include: { assignee: { select: { name: true } } },
    });
    // GraphQL expone camelCase; Prisma devuelve columnas snake_case.
    return rows.map((row) => ({
      milestoneId: row.milestone_id,
      projectId: row.project_id,
      name: row.name,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee.name,
      dueDate: row.due_date,
      status: row.status,
    }));
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
    return prisma.milestone.findUnique({ where: { milestone_id: milestoneId } });
  }

  // Confirmacion de tarea por el PI: transiciona la tarea a Completed.
  async confirmMilestone(pi: AuthenticatedUser, milestoneId: number) {
    if (pi.role !== 'PRINCIPAL_INVESTIGATOR') {
      throw new GraphQLError(
        'Solo el Investigador Principal puede confirmar tareas.',
        { extensions: { code: 'FORBIDDEN' } },
      );
    }

    const milestone = await prisma.milestone.findUnique({
      where: { milestone_id: milestoneId },
    });
    if (!milestone) {
      throw new GraphQLError('Tarea no encontrada.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Verificar que el PI pertenece al proyecto (tabla Project_User).
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
      return updated;
    });
  }
}
