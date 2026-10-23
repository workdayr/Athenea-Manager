import { Injectable } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { GraphQLError } from 'graphql';
import { uploadEvidenceDocument } from '../document_upload/document-upload.service.js';

@Injectable()
export class MilestonesService {
  // Para el Dashboard (trae las tareas del proyecto)
  async getMilestones(user: AuthenticatedUser, projectId: number) {
    // Si es estudiante, solo ve sus tareas. Si es PI, ve todas.
    const where: any = { project_id: projectId };
    if (user.role === 'STUDENT') {
      where.assignee_id = user.id;
    }
    return prisma.milestone.findMany({ where });
  }

  // US 5.2: Subir evidencia y completar (Transaccional)
  async uploadEvidenceAndComplete(user: AuthenticatedUser, milestoneId: number, file: any, ip: string) {
    const milestone = await prisma.milestone.findUnique({ where: { milestone_id: milestoneId } });
    
    if (!milestone) throw new GraphQLError('Tarea no encontrada.', { extensions: { code: 'NOT_FOUND' } });
    
    //  EL CRITERIO DE ACEPTACIÓN (Solo el asignado):
    if (milestone.assignee_id !== user.id) {
      throw new GraphQLError('Solo el usuario asignado puede subir evidencia a esta tarea.', { extensions: { code: 'FORBIDDEN' } });
    }

    // 1. Subimos el archivo reutilizando el código de tu compañero
    const document = await uploadEvidenceDocument(user, milestone.project_id, file, ip);
    
    // 2. Vinculamos el documento a la tarea y la marcamos como completada
    await prisma.projectDocument.update({
      where: { document_id: document.document_id },
      data: { milestone_id: milestone.milestone_id },
    });

    return prisma.milestone.update({
      where: { milestone_id: milestoneId },
      data: { status: 'Completed' },
    });
  }
}