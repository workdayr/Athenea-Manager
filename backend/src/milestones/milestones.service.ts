import { Injectable } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { GraphQLError } from 'graphql';
import { uploadEvidenceDocument } from '../document_upload/document-upload.service.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';

@Injectable()
export class MilestonesService {
  // Para el Dashboard (trae las tareas del proyecto)
  async getMilestones(user: AuthenticatedUser, projectId: number) {
    // Si es estudiante, solo ve sus tareas. Si es PI, ve todas.
    const where: any = { project_id: projectId };
    if (user.role === 'STUDENT') {
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

    // 1. Subimos el archivo reutilizando el servicio de documentos.
    const document = await uploadEvidenceDocument(
      user,
      milestone.project_id,
      file,
      ip,
    );

    // 2. Vinculamos el documento al hito.
    await prisma.projectDocument.update({
      where: { document_id: document.document_id },
      data: { milestone_id: milestone.milestone_id },
    });

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

    console.log(
      `[Notificacion] PI ${pi.id} confirmo la tarea ${milestoneId} del proyecto ${milestone.project_id}.`,
    );

    return prisma.milestone.update({
      where: { milestone_id: milestoneId },
      data: { status: 'Completed' },
    });
  }
}
