import { Injectable } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { uploadEvidenceDocument } from '../document_upload/document-upload.service.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import type { CreateMilestoneInput } from './dto/create-milestone.input.js';
import { isPastDueDate, normalizeMilestoneName } from './milestones.policy.js';

function milestoneError(code: string, message: string, field?: string) {
  return new GraphQLError(message, {
    extensions: { code, field: field ?? null },
  });
}

interface TeamRow {
  user_id: string;
  project_role: string;
  user: { name: string; email: string };
}

interface MilestoneRow {
  milestone_id: number;
  project_id: number;
  name: string;
  assignee_id: string;
  assignee: { name: string };
  due_date: Date;
  created_at: Date;
  status: string;
}

// GraphQL expone camelCase; Prisma devuelve columnas snake_case.
function toMilestoneView(row: MilestoneRow) {
  return {
    milestoneId: row.milestone_id,
    projectId: row.project_id,
    name: row.name,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee.name,
    dueDate: row.due_date,
    createdAt: row.created_at,
    status: row.status,
  };
}

@Injectable()
export class MilestonesService {
  /** Lectura: integrantes del equipo del proyecto (o un Administrador). */
  private async requireProjectMember(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { project_id: projectId },
      select: { project_id: true },
    });
    if (!project) {
      throw milestoneError('NOT_FOUND', 'El proyecto no existe.', 'projectId');
    }
    if (user.role === ROLES.ADMINISTRATOR) {
      return;
    }
    const membership = await prisma.project_User.findFirst({
      where: { project_id: projectId, user_id: user.id },
      select: { projectuser_id: true },
    });
    if (!membership) {
      throw milestoneError(
        'FORBIDDEN',
        'Solo los integrantes del equipo pueden consultar este proyecto.',
        'projectId',
      );
    }
  }

  // Para el Dashboard (trae las tareas del proyecto)
  async getMilestones(user: AuthenticatedUser, projectId: number) {
    await this.requireProjectMember(user, projectId);

    // Si es estudiante, solo ve sus tareas. Si es PI, ve todas.
    const where: any = { project_id: projectId };
    if (user.role === 'STUDENT') {
      where.assignee_id = user.id;
    }
    const rows = await prisma.milestone.findMany({
      where,
      include: { assignee: { select: { name: true } } },
      orderBy: [{ due_date: 'asc' }, { milestone_id: 'asc' }],
    });
    return rows.map(toMilestoneView);
  }

  /** US 5.1: equipo del proyecto, para elegir responsable al crear un hito. */
  async getProjectTeam(user: AuthenticatedUser, projectId: number) {
    await this.requireProjectMember(user, projectId);
    const rows = await prisma.project_User.findMany({
      where: { project_id: projectId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { projectuser_id: 'asc' },
    });
    return rows.map((row: TeamRow) => ({
      userId: row.user_id,
      name: row.user.name,
      email: row.user.email,
      projectRole: row.project_role,
    }));
  }

  /**
   * US 5.1: el Investigador Principal del proyecto planifica un hito.
   * Nace siempre `Pending`; el responsable debe ser del equipo.
   */
  async createMilestone(user: AuthenticatedUser, input: CreateMilestoneInput) {
    const project = await prisma.project.findUnique({
      where: { project_id: input.projectId },
      select: { project_id: true, is_read_only: true },
    });
    if (!project) {
      throw milestoneError('NOT_FOUND', 'El proyecto no existe.', 'projectId');
    }

    const isPrincipalInvestigator = await prisma.project_User.findFirst({
      where: {
        project_id: input.projectId,
        user_id: user.id,
        project_role: 'Principal_Investigator',
      },
      select: { projectuser_id: true },
    });
    if (!isPrincipalInvestigator) {
      throw milestoneError(
        'FORBIDDEN',
        'Solo el Investigador Principal del proyecto puede planificar hitos.',
        'projectId',
      );
    }

    // RF-020: un proyecto archivado es inmutable.
    assertProjectWritable(project);

    const name = normalizeMilestoneName(input.name);
    if (name === null) {
      throw milestoneError(
        'VALIDATION_ERROR',
        'El nombre es obligatorio y no puede exceder 150 caracteres.',
        'name',
      );
    }
    if (Number.isNaN(input.dueDate.getTime()) || isPastDueDate(input.dueDate)) {
      throw milestoneError(
        'VALIDATION_ERROR',
        'La fecha limite no puede ser anterior a hoy.',
        'dueDate',
      );
    }

    // Criterio de aceptacion: solo integrantes del equipo del proyecto.
    const assigneeInTeam = await prisma.project_User.findFirst({
      where: { project_id: input.projectId, user_id: input.assigneeId },
      select: { projectuser_id: true },
    });
    if (!assigneeInTeam) {
      throw milestoneError(
        'VALIDATION_ERROR',
        'El responsable debe ser integrante del equipo del proyecto.',
        'assigneeId',
      );
    }

    const row = await prisma.milestone.create({
      data: {
        project_id: input.projectId,
        name,
        assignee_id: input.assigneeId,
        due_date: input.dueDate,
        status: 'Pending',
      },
      include: { assignee: { select: { name: true } } },
    });
    return toMilestoneView(row);
  }

  // US 5.2: Subir evidencia y completar (Transaccional)
  async uploadEvidenceAndComplete(user: AuthenticatedUser, milestoneId: number, file: any, ip: string) {
    const milestone = await prisma.milestone.findUnique({ where: { milestone_id: milestoneId } });
    
    if (!milestone) throw new GraphQLError('Tarea no encontrada.', { extensions: { code: 'NOT_FOUND' } });
    
    //  EL CRITERIO DE ACEPTACIÓN (Solo el asignado):
    if (milestone.assignee_id !== user.id) {
      throw new GraphQLError('Solo el usuario asignado puede subir evidencia a esta tarea.', { extensions: { code: 'FORBIDDEN' } });
    }

    // RF-020: si el proyecto fue archivado, el hito y su evidencia son inmutables.
    const project = await prisma.project.findUnique({
      where: { project_id: milestone.project_id },
      select: { is_read_only: true },
    });
    if (!project) {
      throw new GraphQLError('Proyecto no encontrado.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    assertProjectWritable(project);

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
